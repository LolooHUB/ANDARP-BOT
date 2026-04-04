const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const { db } = require('../../Automatizaciones/firebase');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dni')
        .setDescription('🪪 Ver o tramitar tu Documento Nacional de Identidad.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('Consultar el documento de otro ciudadano.')
                .setRequired(false)),

    async execute(interaction) {
        // --- 🛡️ RESTRICCIONES DE SEGURIDAD ---
        const ID_CANAL_PERMITIDO = '1490132182604316816';
        const ID_ROL_VERIFICADO = '1476791384894865419';

        // 1. Verificar Canal
        if (interaction.channelId !== ID_CANAL_PERMITIDO) {
            return interaction.reply({ 
                content: `❌ Este comando solo puede utilizarse en el canal <#${ID_CANAL_PERMITIDO}>.`, 
                ephemeral: true 
            });
        }

        // 2. Verificar Rol de Verificado
        if (!interaction.member.roles.cache.has(ID_ROL_VERIFICADO)) {
            return interaction.reply({ 
                content: '❌ Debes estar **Verificado** para poder gestionar tu DNI.', 
                ephemeral: true 
            });
        }

        const target = interaction.options.getUser('usuario') || interaction.user;
        const isSelf = target.id === interaction.user.id;

        try {
            const userRef = db.collection('usuarios_rp').doc(target.id);
            const doc = await userRef.get();

            // --- SI NO ESTÁ REGISTRADO ---
            if (!doc.exists) {
                if (!isSelf) {
                    return interaction.reply({ 
                        content: `❌ El ciudadano **${target.username}** no figura en el registro civil.`, 
                        ephemeral: true 
                    });
                }

                // --- FORMULARIO DE REGISTRO ---
                const modal = new ModalBuilder().setCustomId('modal_crear_dni').setTitle('🪪 Registro de Ciudadanía');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dni_nombre').setLabel("Nombre y Apellidos IC").setStyle(TextInputStyle.Short).setPlaceholder("Ej: Michael De Santa").setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dni_edad').setLabel("Edad").setStyle(TextInputStyle.Short).setMaxLength(2).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dni_genero').setLabel("Género").setStyle(TextInputStyle.Short).setPlaceholder("Masculino / Femenino / Otro").setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dni_nacimiento').setLabel("Fecha de Nacimiento").setStyle(TextInputStyle.Short).setPlaceholder("DD/MM/AAAA").setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dni_nacionalidad').setLabel("Nacionalidad").setStyle(TextInputStyle.Short).setPlaceholder("Ej: Estadounidense").setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            // --- MOSTRAR DNI EXISTENTE ---
            const data = doc.data();
            const licManejo = data.licencias.conducir.estado ? `✅ **Vigente**\n└ *Tipo:* ${data.licencias.conducir.tipo}` : "❌ **No posee**";
            const licArmas = data.licencias.armas.estado ? `✅ **Autorizado**\n└ *Rango:* ${data.licencias.armas.rango}` : "❌ **Sin licencia**";

            const embedDNI = new EmbedBuilder()
                .setAuthor({ name: `DEPARTAMENTO DE JUSTICIA - SAN ANDREAS`, iconURL: interaction.guild.iconURL() })
                .setTitle(`🪪 DOCUMENTO DE IDENTIDAD: #${data.numero_dni}`)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setColor(0x3498DB)
                .addFields(
                    { name: '👤 Identidad', value: `> **Nombre:** ${data.nombre}\n> **Género:** ${data.genero}\n> **Origen:** ${data.nacionalidad}`, inline: false },
                    { name: '📅 Información Personal', value: `**Nacimiento:** ${data.nacimiento}\n**Edad:** ${data.edad} años`, inline: true },
                    { name: '📜 Registro Civil', value: `**Expedido:** ${data.fecha_registro}`, inline: true },
                    { name: '\u200B', value: '--- **CERTIFICACIONES Y LICENCIAS** ---' },
                    { name: '🚗 Conducción', value: licManejo, inline: true },
                    { name: '🔫 Portación de Armas', value: licArmas, inline: true }
                )
                .setFooter({ text: `Registro Único de Ciudadanía - Anda RP`, iconURL: target.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embedDNI] });

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error crítico al consultar el Registro Civil.", ephemeral: true });
        }
    },

    async handleDNIInteractions(interaction) {
        if (interaction.customId !== 'modal_crear_dni') return;
        const { fields, user } = interaction;

        const numDNI = Math.floor(100000000 + Math.random() * 900000000);
        
        const perfilPro = {
            userId: user.id,
            numero_dni: numDNI,
            nombre: fields.getTextInputValue('dni_nombre'),
            edad: fields.getTextInputValue('dni_edad'),
            genero: fields.getTextInputValue('dni_genero'),
            nacimiento: fields.getTextInputValue('dni_nacimiento'),
            nacionalidad: fields.getTextInputValue('dni_nacionalidad'),
            fecha_registro: new Date().toLocaleDateString('es-ES'),
            licencias: {
                conducir: { estado: false, tipo: "Ninguna", puntos: 12, fecha_exp: null },
                armas: { estado: false, rango: "Ninguno", id_permiso: null },
                pesca: { estado: false, expiracion: null },
                vuelo: { estado: false, tipo: "Ninguna" }
            },
            banco: 0,
            trabajo: "Desempleado",
            historial_delictivo: [],
            propiedades: []
        };

        try {
            await db.collection('usuarios_rp').doc(user.id).set(perfilPro);
            return interaction.reply({ 
                content: `🎊 **¡Bienvenido a Anda RP!** Tu DNI ha sido generado con éxito.\n🆔 Número: \`${numDNI}\``, 
                ephemeral: true 
            });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Hubo un fallo al inscribirte en el Registro Civil.", ephemeral: true });
        }
    }
};