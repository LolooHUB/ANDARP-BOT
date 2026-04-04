const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const { db } = require('../../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dni')
        .setDescription('🪪 Gestiona tu Documento Nacional de Identidad.')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('Ver el DNI de otro ciudadano.')
                .setRequired(false)),

    async execute(interaction) {
        const ID_CANAL_PERMITIDO = '1490132182604316816';
        const ID_ROL_VERIFICADO = '1476791384894865419';

        if (interaction.channelId !== ID_CANAL_PERMITIDO) {
            return interaction.reply({ content: `❌ Este trámite solo se realiza en <#${ID_CANAL_PERMITIDO}>.`, ephemeral: true });
        }

        if (!interaction.member.roles.cache.has(ID_ROL_VERIFICADO)) {
            return interaction.reply({ content: '❌ Debes estar **Verificado** para obtener tu documentación.', ephemeral: true });
        }

        const target = interaction.options.getUser('usuario') || interaction.user;
        const isSelf = target.id === interaction.user.id;

        try {
            const userRef = db.collection('usuarios_rp').doc(target.id);
            const doc = await userRef.get();

            if (!doc.exists) {
                if (!isSelf) return interaction.reply({ content: `❌ El ciudadano **${target.username}** no consta en el Registro Civil.`, ephemeral: true });

                const modal = new ModalBuilder().setCustomId('modal_crear_dni').setTitle('🪪 Registro Civil - Catalunya');
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dni_nombre').setLabel("Nombre y Apellidos completos").setStyle(TextInputStyle.Short).setPlaceholder("Ej: Jordi Pujol").setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dni_edad').setLabel("Edad").setStyle(TextInputStyle.Short).setMaxLength(2).setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dni_genero').setLabel("Género").setStyle(TextInputStyle.Short).setPlaceholder("Hombre / Mujer / Otro").setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dni_nacimiento').setLabel("Fecha de Nacimiento").setStyle(TextInputStyle.Short).setPlaceholder("DD/MM/AAAA").setRequired(true)),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dni_nacionalidad').setLabel("Nacionalidad").setStyle(TextInputStyle.Short).setPlaceholder("Ej: Catalana").setRequired(true))
                );
                return await interaction.showModal(modal);
            }

            const data = doc.data();
            
            const licManejo = data.licencias.conducir.estado ? `✅ **Vigente**\n└ *Tipo:* ${data.licencias.conducir.tipo}` : "❌ **No posee**";
            const licArmas = data.licencias.armas.estado ? `✅ **Autorizado**\n└ *Rango:* ${data.licencias.armas.rango}` : "❌ **Sin licencia**";

            const embedDNI = new EmbedBuilder()
                .setAuthor({ name: `MINISTERIO DEL INTERIOR - REGISTRO CIVIL`, iconURL: interaction.guild.iconURL() })
                .setTitle(`🪪 DNI NÚM: ${data.numero_dni}`)
                .setThumbnail(target.displayAvatarURL({ dynamic: true }))
                .setColor(0xF1C40F)
                .addFields(
                    { name: '👤 Identidad', value: `> **Nombre:** ${data.nombre}\n> **Género:** ${data.genero}\n> **Nacionalidad:** ${data.nacionalidad}`, inline: false },
                    { name: '📅 Datos Personales', value: `**Nacimiento:** ${data.nacimiento}\n**Edad:** ${data.edad} años`, inline: true },
                    { name: '📜 Registro', value: `**Fecha:** ${data.fecha_registro}\n**Lugar:** Catalunya`, inline: true },
                    { name: '\u200B', value: '--- **CERTIFICACIONES Y PERMISOS** ---' },
                    { name: '🚗 Conducción', value: licManejo, inline: true },
                    { name: '🔫 Portación de Armas', value: licArmas, inline: true }
                )
                .setFooter({ text: `Documento Oficial - Anda RP Catalunya`, iconURL: target.displayAvatarURL() })
                .setTimestamp();

            return interaction.reply({ embeds: [embedDNI] });

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error en el sistema de archivos del Registro.", ephemeral: true });
        }
    },

    async handleDNIInteractions(interaction) {
        if (interaction.customId !== 'modal_crear_dni') return;
        const { fields, user } = interaction;
        const numDNI = Math.floor(100000000 + Math.random() * 900000000);
        
        const perfilCiudadano = {
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
            banco: 5000,
            trabajo: "Desempleado",
            historial_delictivo: [],
            propiedades: []
        };

        try {
            await db.collection('usuarios_rp').doc(user.id).set(perfilCiudadano);
            return interaction.reply({ content: `✅ **DNI Tramitado.** Bienvenido/a a Catalunya. Tu ID es: \`${numDNI}\`.`, ephemeral: true });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error al inscribir en el Registro Civil.", ephemeral: true });
        }
    }
};