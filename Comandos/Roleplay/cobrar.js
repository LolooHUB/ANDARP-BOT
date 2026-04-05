const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cobrar')
        .setDescription('💶 Reclama tu salario diario y bonos según tu rango.'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const roles = interaction.member.roles.cache;

        // --- TABLA DE SALARIOS ---
        const SALARIOS = {
            '1490138479567306864': 2500, // Mossos / Policía
            '1490137700127477800': 2000, // Rango A
            '1490138289087447108': 2000, // Rango B
            '1490137717630173264': 2000, // Rango C
            '1490137887122129016': 3000  // Rango Especial / Alto
        };

        const ID_BONO_VIP = '1476765603418079434';
        const MONTO_VIP = 1000;

        let sueldoTotal = 0;
        let tieneTrabajo = false;

        // Calcular sueldo base (solo el más alto si tiene varios de la lista)
        for (const [idRol, monto] of Object.entries(SALARIOS)) {
            if (roles.has(idRol)) {
                if (monto > sueldoTotal) sueldoTotal = monto;
                tieneTrabajo = true;
            }
        }

        // Sumar bono VIP si lo tiene
        if (roles.has(ID_BONO_VIP)) {
            sueldoTotal += MONTO_VIP;
        }

        if (sueldoTotal === 0) {
            return interaction.reply({ 
                content: "❌ No tienes asignado ningún rol con salario ni beneficios VIP.", 
                ephemeral: true 
            });
        }

        try {
            const userRef = db.collection('usuarios_rp').doc(userId);
            const doc = await userRef.get();

            if (!doc.exists) {
                return interaction.reply({ content: "❌ No tienes DNI. Regístrate primero para abrir tu cuenta bancaria.", ephemeral: true });
            }

            const data = doc.data();
            const ahora = Date.now();
            const unDia = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

            // --- VALIDACIÓN DE COOLDOWN ---
            if (data.ultimo_cobro && (ahora - data.ultimo_cobro < unDia)) {
                const tiempoRestante = unDia - (ahora - data.ultimo_cobro);
                const horas = Math.floor(tiempoRestante / (1000 * 60 * 60));
                const minutos = Math.floor((tiempoRestante % (1000 * 60 * 60)) / (1000 * 60));
                
                return interaction.reply({ 
                    content: `⏳ Ya has cobrado hoy. Debes esperar **${horas}h ${minutos}m** para tu próxima nómina.`, 
                    ephemeral: true 
                });
            }

            // --- ACTUALIZAR BALANCE ---
            const nuevoSaldo = (data.banco || 0) + sueldoTotal;
            await userRef.update({ 
                banco: nuevoSaldo,
                ultimo_cobro: ahora 
            });

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'TESORERÍA DE LA GENERALITAT', iconURL: 'https://i.imgur.com/vH8vL4S.png' })
                .setTitle('🏦 Nómina Ingresada')
                .setColor(0x2ECC71)
                .setDescription(`Se ha procesado el pago de tus haberes diarios.`)
                .addFields(
                    { name: '💰 Total Recibido', value: `**${sueldoTotal.toLocaleString()}€**`, inline: true },
                    { name: '📊 Nuevo Balance', value: `${nuevoSaldo.toLocaleString()}€`, inline: true },
                    { name: '🎗️ Beneficios', value: roles.has(ID_BONO_VIP) ? 'Sueldo Base + Bono VIP ✅' : 'Sueldo Base ✅', inline: false }
                )
                .setFooter({ text: 'Generalitat de Catalunya - Pagos de Función Pública' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: false });

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error al procesar el pago en el sistema central.", ephemeral: true });
        }
    }
};