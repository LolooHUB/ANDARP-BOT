const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

/**
 * 💸 MÓDULO BANCARIO - ANDA RP
 */

// --- 🎨 EMOJIS INTEGRADOS ---
const E_EURO = '<:Euro:1493238471555289208>';
const E_TICK = '<:TickVerde:1493314122958245938>';
const E_ALERTA = '<:Problema1:1493237859384164362>';
const E_BAN = '<:Ban:1493314179631681737>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pagar')
        .setDescription('💸 Realizar una transferencia bancaria a otro ciudadano.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('El ciudadano que recibirá el dinero.')
                .setRequired(true))
        .addIntegerOption(option => 
            option.setName('monto')
                .setDescription('Cantidad de euros a enviar.')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const remitente = interaction.user;
        const receptor = interaction.options.getUser('usuario');
        const monto = interaction.options.getInteger('monto');

        // --- VALIDACIONES BÁSICAS ---
        if (remitente.id === receptor.id) {
            return interaction.reply({ content: `${E_ALERTA} No puedes transferirte dinero a ti mismo.`, ephemeral: true });
        }

        if (receptor.bot) {
            return interaction.reply({ content: `${E_BAN} No puedes enviar dinero a entidades no registradas (Bots).`, ephemeral: true });
        }

        try {
            const refRemitente = db.collection('usuarios_rp').doc(remitente.id);
            const refReceptor = db.collection('usuarios_rp').doc(receptor.id);

            const [docRem, docRec] = await Promise.all([refRemitente.get(), refReceptor.get()]);

            // --- VALIDACIÓN DE EXISTENCIA (DNI) ---
            if (!docRem.exists) {
                return interaction.reply({ content: `${E_BAN} No tienes una cuenta bancaria activa. Tramita tu DNI primero.`, ephemeral: true });
            }
            if (!docRec.exists) {
                return interaction.reply({ content: `${E_ALERTA} El ciudadano **${receptor.username}** no dispone de una cuenta bancaria en el Registro Civil.`, ephemeral: true });
            }

            const dataRem = docRem.data();
            const dataRec = docRec.data();

            // --- VALIDACIÓN DE SALDO ---
            if (dataRem.banco < monto) {
                return interaction.reply({ 
                    content: `${E_ALERTA} **Fondos insuficientes.** Tu saldo actual es de **${dataRem.banco.toLocaleString()}€** ${E_EURO}.`, 
                    ephemeral: true 
                });
            }

            // --- EJECUCIÓN DE LA TRANSACCIÓN SEGURA ---
            await db.runTransaction(async (t) => {
                t.update(refRemitente, { banco: dataRem.banco - monto });
                t.update(refReceptor, { banco: dataRec.banco + monto });
            });

            // --- FEEDBACK VISUAL ---
            const embedRemitente = new EmbedBuilder()
                .setAuthor({ name: 'CAIXABANK - COMPROBANTE DE TRANSFERENCIA', iconURL: 'https://i.imgur.com/vH8vL4S.png' })
                .setTitle(`${E_TICK} Operación Finalizada`)
                .setColor(0x2ECC71)
                .setDescription(`Has enviado **${monto.toLocaleString()}€** ${E_EURO} correctamente.`)
                .addFields(
                    { name: '👤 Beneficiario', value: `${dataRec.nombre}`, inline: true },
                    { name: '🆔 DNI Receptor', value: `#${dataRec.numero_dni}`, inline: true },
                    { name: '💰 Saldo Restante', value: `**${(dataRem.banco - monto).toLocaleString()}€** ${E_EURO}`, inline: false }
                )
                .setFooter({ text: 'Banc de Catalunya' })
                .setTimestamp();

            await interaction.reply({ embeds: [embedRemitente] });

            // --- NOTIFICACIÓN AL RECEPTOR ---
            try {
                const embedReceptor = new EmbedBuilder()
                    .setTitle(`${E_EURO} Ingreso Recibido`)
                    .setColor(0x3498DB)
                    .setDescription(`Has recibido **${monto.toLocaleString()}€** ${E_EURO} en tu cuenta bancaria.`)
                    .addFields(
                        { name: '👤 Emisor', value: `${dataRem.nombre}`, inline: true },
                        { name: '📊 Nuevo Saldo', value: `**${(dataRec.banco + monto).toLocaleString()}€** ${E_EURO}`, inline: true }
                    )
                    .setTimestamp();

                await receptor.send({ embeds: [embedReceptor] });
            } catch (e) {
                // DM Cerrado: La transacción ya fue exitosa en DB
            }

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: `${E_ALERTA} Error crítico en la red bancaria. Inténtalo de nuevo más tarde.`, ephemeral: true });
        }
    }
};