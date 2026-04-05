const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../Automatizaciones/firebase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cobrar')
        .setDescription('💶 Reclama tu salario diario, bonos acumulados o subsidio de desempleo.'),

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
        const SUBSIDIO_DESEMPLEO = 1000; // Regalo del estado

        let sueldoTotal = 0;
        let tieneTrabajo = false;
        let detallesSueldo = [];

        // 1. Sumar salarios de forma ACUMULATIVA
        for (const [idRol, monto] of Object.entries(SALARIOS)) {
            if (roles.has(idRol)) {
                sueldoTotal += monto;
                tieneTrabajo = true;
                // Opcional: obtener nombre del rol para el embed
                const roleName = interaction.guild.roles.cache.get(idRol)?.name || "Trabajo";
                detallesSueldo.push(`✅ **${roleName}**: +${monto.toLocaleString()}€`);
            }
        }

        // 2. Si no tiene ningún trabajo de la lista, aplicar subsidio
        if (!tieneTrabajo) {
            sueldoTotal += SUBSIDIO_DESEMPLEO;
            detallesSueldo.push(`🆘 **Subsidio Desempleo**: +${SUBSIDIO_DESEMPLEO.toLocaleString()}€`);
        }

        // 3. Sumar bono VIP si lo tiene
        if (roles.has(ID_BONO_VIP)) {
            sueldoTotal += MONTO_VIP;
            detallesSueldo.push(`⭐ **Bono VIP**: +${MONTO_VIP.toLocaleString()}€`);
        }

        try {
            const userRef = db.collection('usuarios_rp').doc(userId);
            const doc = await userRef.get();

            if (!doc.exists) {
                return interaction.reply({ content: "❌ No tienes DNI. Regístrate primero para abrir tu cuenta bancaria.", ephemeral: true });
            }

            const data = doc.data();
            const ahora = Date.now();
            const unDia = 24 * 60 * 60 * 1000;

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
                .setAuthor({ name: 'DEPARTAMENT D\'ECONOMIA I HISENDA', iconURL: 'https://i.imgur.com/vH8vL4S.png' })
                .setTitle('🏦 Ingreso de Haberes Realizado')
                .setColor(tieneTrabajo ? 0x2ECC71 : 0x3498DB) // Verde si trabaja, azul si es subsidio
                .setDescription(`Se han depositado los fondos correspondientes a su actividad diaria en su cuenta corriente.`)
                .addFields(
                    { name: '💰 Total Recibido', value: `**${sueldoTotal.toLocaleString()}€**`, inline: true },
                    { name: '📊 Nuevo Balance', value: `${nuevoSaldo.toLocaleString()}€`, inline: true },
                    { name: '📝 Desglose de nómina', value: detallesSueldo.join('\n'), inline: false }
                )
                .setFooter({ text: 'Generalitat de Catalunya - Red de Tesorería Automática' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            return interaction.reply({ content: "❌ Error al conectar con la base de datos de la Generalitat.", ephemeral: true });
        }
    }
};