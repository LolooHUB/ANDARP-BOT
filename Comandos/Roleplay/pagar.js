const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../../Automatizaciones/firebase');

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
            return interaction.reply({ content: "❌ No puedes transferirte dinero a ti mismo.", ephemeral: true });
        }

        if (receptor.bot) {
            return interaction.reply({ content: "❌ No puedes enviar dinero a entidades no registradas (Bots).", ephemeral: true });
        }

        try {
            const refRemitente = db.collection('usuarios_rp').doc(remitente.id);
            const refReceptor = db.collection('usuarios_rp').doc(receptor.id);

            const [docRem, docRec] = await Promise.all([refRemitente.get(), refReceptor.get()]);

            // --- VALIDACIÓN DE EXISTENCIA (DNI) ---
            if (!docRem.exists) {
                return interaction.reply({ content: "❌ No tienes una cuenta bancaria activa. Tramita tu DNI primero.", ephemeral: true });
            }
            if (!docRec.exists) {
                return interaction.reply({ content: `❌ El ciudadano **${receptor.username}** no dispone de una cuenta bancaria en el Registro Civil.`, ephemeral: true });
            }

            const dataRem = docRem.data();
            const dataRec = docRec.data();

            // --- VALIDACIÓN DE SALDO ---
            if (dataRem.banco < monto) {
                return interaction.reply({ 
                    content: `❌ **Fondos insuficientes.** Tu saldo actual es de **${dataRem.banco.toLocaleString()}€**.`, 
                    ephemeral: true 
                });
            }

            // --- EJECUCIÓN DE LA TRANSACCIÓN ---
            await db.runTransaction(async (t) => {
                t.update(refRemitente, { banco: dataRem.banco - monto });
                t.update(refReceptor, { banco: dataRec.banco + monto });
            });

            // --- FEEDBACK VISUAL ---
            const embedRemitente = new EmbedBuilder()
                .setAuthor({ name: 'CAIXABANK - COMPROBANTE DE TRANSFERENCIA', iconURL: 'https://i.imgur.com/vH8vL4S.png' })
                .setTitle('✅ Operación Finalizada')
                .setColor(0x2ECC71)
                .setDescription(`Has enviado **${monto.toLocaleString()}€** correctamente.`)
                .addFields(
                    { name: '👤 Beneficiario', value: `${dataRec.nombre}`, inline: true },
                    { name: '🆔 DNI Receptor', value: `#${dataRec.numero_dni}`, inline: true },
                    { name: '💰 Saldo Restante', value: `**${(dataRem.banco - monto).toLocaleString()}€**`, inline: false }
                )
                .setFooter({ text: 'Banc de Catalunya' })
                .setTimestamp();

            await interaction.reply({ embeds: [embedRemitente] });

            // --- NOTIFICACIÓN AL RECEPTOR ---
            try {
                const embedReceptor = new EmbedBuilder()
                    .setTitle('💰 Ingreso Recibido')
                    .setColor(0x3498DB)
                    .setDescription(`Has recibido **${monto.toLocaleString()}€** en tu cuenta bancaria.`)
                    .addFields(
                        { name: '👤 Emisor', value: `${dataRem.nombre}`, inline: true },
                        { name: '📊 Nuevo Saldo', value: `**${(dataRec.banco + monto).toLocaleString()}€**`, inline: true }
                    )
                    .setTimestamp();

                await receptor.send({ embeds: [embedReceptor] });
            } catch (e) {
                // Si tiene DMs cerrados, el dinero llega igual pero no recibe el mensaje privado
            }

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error crítico en la red bancaria. Inténtalo de nuevo más tarde.", ephemeral: true });
        }
    }
};