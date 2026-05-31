import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AddResident() {
    const [flats, setFlats] = useState<any[]>([]);

    const [form, setForm] = useState({
        full_name: "",
        phone: "",
        flat_id: "",
        block_name: "",
        family_count: 1,
    });

    // Load flats for dropdown
    useEffect(() => {
        const fetchFlats = async () => {
            const { data, error } = await supabase
                .from("flats")
                .select("id, flat_number, block_name");

            if (!error) setFlats(data || []);
        };

        fetchFlats();
    }, []);

    const handleChange = (e: any) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: any) => {
        e.preventDefault();

        if (!form.flat_id) {
            alert("Please select a flat");
            return;
        }

        // 1. Insert resident
        const { error } = await supabase.from("residents").insert({
            full_name: form.full_name,
            phone: form.phone,
            flat_id: form.flat_id,
            block_name: form.block_name,
            family_count: Number(form.family_count),
        });

        if (error) {
            console.error(error);
            alert("Failed to add resident");
            return;
        }

        // 2. Mark flat as occupied automatically
        await supabase
            .from("flats")
            .update({ status: "occupied" })
            .eq("id", form.flat_id);

        alert("Resident added successfully");

        // reset form
        setForm({
            full_name: "",
            phone: "",
            flat_id: "",
            block_name: "",
            family_count: 1,
        });
    };

    return (
        <div style={{ padding: 20 }}>
            <h2>Add Resident</h2>

            <form onSubmit={handleSubmit}>
                <input
                    name="full_name"
                    placeholder="Full Name"
                    value={form.full_name}
                    onChange={handleChange}
                />

                <input
                    name="phone"
                    placeholder="Phone"
                    value={form.phone}
                    onChange={handleChange}
                />

                <input
                    name="block_name"
                    placeholder="Block Name"
                    value={form.block_name}
                    onChange={handleChange}
                />

                <input
                    name="family_count"
                    type="number"
                    placeholder="Family Count"
                    value={form.family_count}
                    onChange={handleChange}
                />

                {/* Flats dropdown */}
                <select
                    name="flat_id"
                    value={form.flat_id}
                    onChange={handleChange}
                >
                    <option value="">Select Flat</option>
                    {flats.map((flat) => (
                        <option key={flat.id} value={flat.id}>
                            {flat.block_name} - {flat.flat_number}
                        </option>
                    ))}
                </select>

                <button type="submit">Add Resident</button>
            </form>
        </div>
    );
}