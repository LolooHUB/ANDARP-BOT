/**
 * 🏦 MÓDULO FINANCIERO - ANDA RP v3.0
 * ---------------------------------------------------------
 * SISTEMA CENTRAL DE CAIXABANK Y HACIENDA
 * - Slash Command para ciudadanos (Consulta de saldo).
 * - Prefijo Admin para Staff (Gestión de fondos).
 * - Integración con Firebase Firestore.
 * - Emojis personalizados y log de transacciones.
 * ---------------------------------------------------------
 */

const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    AttachmentBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const { db } = require('../Automatizaciones/firebase');
const fs = require('fs');

// --- 🎨 DEFINICIÓN DE EMOJIS ---
const E_EURO = '<:Euro:1493238471555289208>';
const E_TICK = '<:TickVerde:1493314122958245938>';
const E_ALERTA = '<:Problema1:1493237859384164362>';
const E_DNI = '<:Aprobado1:1493237545486516224>';
const E_BANK = '🏦';
const E_CASH = '💵';

module.exports = {
    // 1️⃣ PARTE PÚBLICA: SLASH COMMAND PARA CIUDADANOS
    data: new SlashCommandBuilder()
        .setName('banco')
        .setDescription('🏦 Consulta tu saldo y estado de cuenta bancario en CaixaBank.'),

    async execute(interaction) {
        const RUTA_LOGO = './attachments/LogoPFP.png';
        const userId = interaction.user.id;

        try {
            // Referencia a la base de datos de Firebase
            const userRef = db.collection('usuarios_rp').doc(userId);
            const doc = await userRef.get();

            // Validación de existencia de usuario
            if (!doc.exists) {
                return interaction.reply({ 
                    content: `${E_ALERTA} No figura ninguna cuenta a su nombre. Por favor, tramite su DNI primero ${E_DNI}.`, 
                    ephemeral: true 
                });
            }

            const data = doc.data();
            const saldo = data.banco || 0;
            const nombreRP = data.nombre || interaction.user.username;
            const dniUser = data.numero_dni || "N/A";

            // Preparación de archivo visual
            let files = [];
            if (fs.existsSync(RUTA_LOGO)) {
                files.push(new AttachmentBuilder(RUTA_LOGO));
            }

            // Construcción del Embed Bancario
            const embedBancario = new EmbedBuilder()
                .setAuthor({ 
                    name: 'CAIXABANK • SERVICIOS AL CLIENTE', 
                    iconURL: 'https://i.imgur.com/vH8vL4S.png' 
                })
                .setTitle(`Bienvenido de nuevo, ${nombreRP}`)
                .setColor(0x00A1DE)
                .setThumbnail(fs.existsSync(RUTA_LOGO) ? 'attachment://LogoPFP.png' : null)
                .setDescription(
                    `Estimado cliente, aquí tiene el resumen de sus activos financieros registrados en nuestra sucursal central.`
                )
                .addFields(
                    { 
                        name: `${E_CASH} Saldo Disponible`, 
                        value: `> **${saldo.toLocaleString('es-ES')}€** ${E_EURO}`, 
                        inline: false 
                    },
                    { 
                        name: `${E_BANK} Número de Cuenta`, 
                        value: `\`ES${dniUser}99-CAIXA\``, 
                        inline: true 
                    },
                    { 
                        name: `${E_DNI} Estado de Cuenta`, 
                        value: `🟢 Activa`, 
                        inline: true 
                    }
                )
                .setFooter({ text: 'Banc de Catalunya • Seguridad Garantizada' })
                .setTimestamp();

            // Botón de acceso rápido (Opcional - Estético)
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('Historial de Movimientos')
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId('ver_historial')
                    .setDisabled(true)
            );

            return interaction.reply({ 
                embeds: [embedBancario], 
                components: [row],
                files: files,
                ephemeral: false 
            });

        } catch (error) {
            console.error("Error en Comando Banco:", error);
            return interaction.reply({ 
                content: `${E_ALERTA} Se ha producido un error al conectar con los servidores de CaixaBank.`, 
                ephemeral: true 
            });
        }
    },

    // 2️⃣ PARTE PRIVADA: COMANDO DE STAFF (!money give @user cantidad)
    async handleAdminMoney(message) {
        // Configuración de Seguridad
        const ROLES_ADMIN = [
            '1476769136209301534', // Founder
            '1476769557539721307', // Admin
            '1476769611675336744'  // Mod
        ];

        // 1. Verificación de Permisos
        const tienePermiso = message.member.roles.cache.some(role => ROLES_ADMIN.includes(role.id));
        if (!tienePermiso) return; 

        // 2. Parseo de Argumentos (!money give @user 5000)
        const args = message.content.split(' ');
        const accion = args[1]; // give, set, remove
        const targetUser = message.mentions.users.first();
        const cantidad = parseInt(args[args.length - 1]);

        // 3. Validaciones Técnicas
        if (!targetUser || isNaN(cantidad) || !accion) {
            const msgErr = await message.reply(`❌ **Uso Correcto:** \`!money [give|set|remove] @user cantidad\``);
            return setTimeout(() => msgErr.delete().catch(() => {}), 5000);
        }

        try {
            const userRef = db.collection('usuarios_rp').doc(targetUser.id);
            const doc = await userRef.get();

            if (!doc.exists) {
                const msgErr = await message.reply(`❌ El ciudadano **${targetUser.username}** no tiene un DNI registrado.`);
                return setTimeout(() => msgErr.delete().catch(() => {}), 5000);
            }

            const data = doc.data();
            let saldoActual = data.banco || 0;
            let nuevoSaldo;

            // 4. Lógica de Operación
            switch (accion.toLowerCase()) {
                case 'give':
                    nuevoSaldo = saldoActual + cantidad;
                    break;
                case 'remove':
                    nuevoSaldo = Math.max(0, saldoActual - cantidad);
                    break;
                case 'set':
                    nuevoSaldo = cantidad;
                    break;
                default:
                    return;
            }

            // 5. Actualización en Firebase
            await userRef.update({ 
                banco: nuevoSaldo,
                ultima_modificacion_staff: {
                    admin: message.author.id,
                    fecha: new Date().toISOString(),
                    tipo: accion
                }
            });

            // 6. Limpieza y Logs
            if (message.deletable) await message.delete().catch(() => {});

            const embedLog = new EmbedBuilder()
                .setTitle(`${E_TICK} TRANSACCIÓN BANCARIA ESTATAL`)
                .setColor(accion === 'give' ? '#2ECC71' : '#E74C3C')
                .setDescription(`Se ha modificado el capital de **${data.nombre}**.`)
                .addFields(
                    { name: 'Acción', value: `\`${accion.toUpperCase()}\``, inline: true },
                    { name: 'Cantidad', value: `\`${cantidad.toLocaleString()}€\``, inline: true },
                    { name: 'Saldo Final', value: `**${nuevoSaldo.toLocaleString()}€** ${E_EURO}`, inline: true }
                )
                .setFooter({ text: `Admin: ${message.author.username}` })
                .setTimestamp();

            const msgConfirm = await message.channel.send({ embeds: [embedLog] });
            setTimeout(() => msgConfirm.delete().catch(() => {}), 7000);

            // 7. Notificación DM al Usuario
            try {
                const embedUser = new EmbedBuilder()
                    .setAuthor({ name: 'NOTIFICACIÓN CAIXABANK', iconURL: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTr6zOUuPogxrSmmYmcU9P8AN61b6XDSf-40w&s' })
                    .setDescription(`Estimado cliente, se ha registrado un movimiento en su cuenta.`)
                    .addFields(
                        { name: 'Concepto', value: 'Gestión Administrativa / Hacienda', inline: true },
                        { name: 'Importe', value: `${cantidad.toLocaleString()}€ ${E_EURO}`, inline: true }
                    )
                    .setColor(0x00A1DE)
                    .setTimestamp();

                await targetUser.send({ embeds: [embedUser] });
            } catch (e) {
                console.warn(`No se pudo enviar DM a ${targetUser.id}`);
            }

        } catch (error) {
            console.error("Error Crítico en Admin Money:", error);
            message.channel.send(`❌ Error fatal al procesar la transacción en la base de datos.`);
        }
    }
};