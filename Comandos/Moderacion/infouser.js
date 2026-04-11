const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('infouser')
        .setDescription('🔍 Consulta el historial de sanciones y verificación de un usuario.')
        .addUserOption(opt => 
            opt.setName('usuario')
                .setDescription('Usuario a consultar')
                .setRequired(true)),

    async execute(interaction) {
        // --- 🛡️ CONTROL DE ACCESO (STAFF HIERARCHY) ---
        const staffHierarchy = [
            '1476765837825277992', // [0] Helper
            '1476766248242118697', // [1] Mod en pruebas
            '1476766796861149284', // [2] Mod
            '1476767536530849822', // [3] Supervision basica
            '1476767750625038336', // [4] Administrador
            '1482153188856434828', // [5] Compras
            '1476768019496829033', // [6] Supervision Avanzada
            '1476768122915782676', // [7] Manager
            '1476768405037125885', // [8] Community Manager
            '1476768951034970253'  // [9] Fundacion
        ];

        const tienePermiso = interaction.member.roles.cache.some(role => staffHierarchy.includes(role.id));

        if (!tienePermiso) {
            return interaction.reply({ 
                content: '❌ No tienes permiso para consultar información privada de usuarios.', 
                ephemeral: true 
            });
        }
        // ----------------------------------------------

        const user = interaction.options.getUser('usuario');
        const member = interaction.options.getMember('usuario');
        const rolVerificadoId = '1476791384894865419';
        
        await interaction.deferReply({ ephemeral: false });

        // 1. Consultas en Firebase (Persistencia)
        const [warnsSnap, kicksSnap, bansSnap, blacklistDoc] = await Promise.all([
            db.collection('sanciones_warns').where('usuarioId', '==', user.id).get(),
            db.collection('sanciones_kicks').where('usuarioId', '==', user.id).get(),
            db.collection('sanciones_bans').where('usuarioId', '==', user.id).get(),
            db.collection('blacklist').doc(user.id).get()
        ]);

        const totalWarns = warnsSnap.size;
        const totalKicks = kicksSnap.size;
        const totalBans = bansSnap.size;
        const isBlacklisted = blacklistDoc.exists ? "✅ SÍ (VETADO)" : "❌ NO";

        // 2. Verificar Rol de Verificación
        const estaVerificado = member && member.roles.cache.has(rolVerificadoId) 
            ? "✅ **VERIFICADO**" 
            : "❌ **NO VERIFICADO**";

        // 3. Construcción del Embed
        const embedInfo = new EmbedBuilder()
            .setColor('#e1ff00') 
            .setTitle(`👤 Información de Usuario: ${user.username}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true }))
            .setAuthor({ name: 'Anda RP - Sistema de Datos', iconURL: 'attachment://LogoPFP.png' })
            .addFields(
                { name: '🆔 **ID DE DISCORD**', value: `\`${user.id}\``, inline: true },
                { name: '📅 **CUENTA CREADA**', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '📥 **INGRESO AL SERVER**', value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "No está en el servidor", inline: true },
                
                { name: '🛡️ **ESTADO DE VERIFICACIÓN**', value: estaVerificado, inline: false },

                { name: '\u200B', value: '📊 **HISTORIAL DE SANCIONES**' },
                
                { name: '⚠️ **WARNS**', value: `**${totalWarns}**`, inline: true },
                { name: '🚨 **KICKS**', value: `**${totalKicks}**`, inline: true },
                { name: '🚫 **BANS**', value: `**${totalBans}**`, inline: true },
                { name: '💀 **EN BLACKLIST**', value: `**${isBlacklisted}**`, inline: false }
            )
            .setFooter({ text: 'Anda RP - Rol de calidad', iconURL: 'attachment://LogoPFP.png' })
            .setTimestamp();

        // 4. Mostrar historial rápido de Warns
        if (totalWarns > 0) {
            let lastWarns = "";
            warnsSnap.docs.slice(-3).reverse().forEach(doc => {
                const d = doc.data();
                lastWarns += `• **Motivo:** ${d.motivo} (Por: <@${d.moderadorId}>)\n`;
            });
            embedInfo.addFields({ name: '📝 **DETALLES RECIENTES (Warns)**', value: lastWarns });
        }

        await interaction.editReply({ 
            embeds: [embedInfo], 
            files: ['./attachment/LogoPFP.png'] 
        });
    }
};