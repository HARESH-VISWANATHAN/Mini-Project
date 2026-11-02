package ui;

import data.SampleData;
import model.*;
import service.DispatchService;
import vehicle.DeliveryVehicle;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;

/**
 * Desktop frontend for the supply-chain application. All operations call the
 * same DispatchService used by the console application.
 */
public class DesktopApp extends JFrame {
    private static final Color PAGE = new Color(244, 247, 251);
    private static final Color NAVY = new Color(22, 38, 63);
    private static final Color BLUE = new Color(31, 111, 178);
    private static final Color TEAL = new Color(18, 139, 131);
    private static final Color TEXT = new Color(35, 48, 65);
    private static final Color MUTED = new Color(104, 119, 138);

    private DispatchService service;
    private final JTabbedPane tabs = new JTabbedPane();
    private final JTextArea dashboard = new JTextArea();
    private final DefaultTableModel warehouseModel = model("ID", "Warehouse", "Rice (kg)", "Wheat (kg)", "Sugar (kg)");
    private final DefaultTableModel shopModel = model("ID", "Shop", "Rice (kg)", "Wheat (kg)", "Sugar (kg)");
    private final DefaultTableModel vehicleModel = model("Vehicle", "Type", "Capacity (kg)", "Status");
    private final DefaultTableModel requestModel = model("Request ID", "Shop", "Urgency", "Items", "Total kg", "Status", "Details");
    private final DefaultTableModel transitModel = model("Request ID", "Shop", "Vehicle", "Delivery details");
    private final DefaultTableModel historyModel = model("Record", "Details");
    private final JTextField requestId = new JTextField(10);
    private final JComboBox<String> shopChoice = new JComboBox<>();
    private final JComboBox<String> urgencyChoice = new JComboBox<>(new String[]{"1", "2", "3", "4", "5"});
    private final JComboBox<String> commodityChoice = new JComboBox<>(SampleData.COMMODITIES);
    private final JSpinner quantity = new JSpinner(new SpinnerNumberModel(100, 1, 100000, 10));
    private final Map<String, Double> draftItems = new TreeMap<>();
    private final JTextArea draftDisplay = new JTextArea(4, 25);
    private final JTextArea log = new JTextArea();

    public DesktopApp() {
        super("Valam | Public Distribution Supply Chain");
        installTheme();
        service = newService();
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setMinimumSize(new Dimension(1050, 680));
        setSize(1200, 760);
        setLocationRelativeTo(null);
        getContentPane().setBackground(PAGE);
        buildUI();
        refreshAll();
    }

    private void installTheme() {
        try {
            UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
        } catch (ClassNotFoundException | InstantiationException | IllegalAccessException
                 | UnsupportedLookAndFeelException ignored) {
            System.err.println("Platform theme unavailable; using Swing defaults: "
                    + ignored.getMessage());
        }
        UIManager.put("TabbedPane.selected", Color.WHITE);
        UIManager.put("TabbedPane.contentAreaColor", PAGE);
        UIManager.put("TabbedPane.focus", new Color(0, 0, 0, 0));
        UIManager.put("ComboBox.background", Color.WHITE);
        UIManager.put("Table.gridColor", new Color(226, 232, 240));
        UIManager.put("Table.selectionBackground", new Color(216, 235, 248));
        UIManager.put("Table.selectionForeground", TEXT);
    }

    private DispatchService newService() {
        DispatchService s = SampleData.buildNetwork();
        SampleData.loadDemoRequests(s);
        return s;
    }

    private void buildUI() {
        JPanel root = new JPanel(new BorderLayout(0, 0));
        root.setBackground(PAGE);
        JPanel header = new JPanel(new BorderLayout());
        header.setBackground(NAVY);
        header.setBorder(new EmptyBorder(20, 28, 20, 28));
        JLabel title = new JLabel("VALAM  /  SUPPLY CHAIN CONTROL CENTER");
        title.setForeground(Color.WHITE); title.setFont(new Font("SansSerif", Font.BOLD, 22));
        JLabel subtitle = new JLabel("PUBLIC DISTRIBUTION SYSTEM  |  INVENTORY  •  DISPATCH  •  ROUTES");
        subtitle.setForeground(new Color(205, 218, 236)); subtitle.setFont(new Font("SansSerif", Font.PLAIN, 13));
        JPanel words = new JPanel(); words.setOpaque(false); words.setLayout(new BoxLayout(words, BoxLayout.Y_AXIS));
        words.add(title); words.add(Box.createVerticalStrut(5)); words.add(subtitle);
        header.add(words, BorderLayout.CENTER);
        JButton reset = new JButton("Reset demo");
        styleButton(reset, false);
        reset.addActionListener(e -> { service = newService(); draftItems.clear(); updateDraft(); log.setText(""); refreshAll(); message("Demo data reloaded."); });
        header.add(reset, BorderLayout.EAST);
        root.add(header, BorderLayout.NORTH);

        tabs.setFont(new Font("SansSerif", Font.BOLD, 12));
        tabs.setBackground(PAGE);
        tabs.setBorder(new EmptyBorder(8, 12, 0, 12));
        tabs.addTab("Dashboard", dashboardPanel());
        tabs.addTab("Warehouses", warehousePanel());
        tabs.addTab("Fair Price Shops", tablePanel(shopModel));
        tabs.addTab("Vehicles", tablePanel(vehicleModel));
        tabs.addTab("Requests", requestsPanel());
        tabs.addTab("New Request", createRequestPanel());
        tabs.addTab("Dispatch & Receipts", dispatchPanel());
        tabs.addTab("History", historyPanel());
        root.add(tabs, BorderLayout.CENTER);
        setContentPane(root);
    }

    private JPanel dashboardPanel() {
        JPanel p = new JPanel(new BorderLayout(16, 16));
        p.setBorder(new EmptyBorder(20, 22, 22, 22)); p.setBackground(PAGE);
        JPanel cards = new JPanel(new GridLayout(1, 4, 12, 12)); cards.setOpaque(false);
        cards.add(statCard("Warehouses", "2", "Central + Regional"));
        cards.add(statCard("Fair price shops", "8", "Shop network"));
        cards.add(statCard("Delivery vehicles", "3", "2 vans + 1 truck"));
        cards.add(statCard("Road locations", "14", "Weighted graph"));
        p.add(cards, BorderLayout.NORTH);
        dashboard.setEditable(false);         dashboard.setFont(new Font("SansSerif", Font.PLAIN, 14));
        dashboard.setBackground(Color.WHITE); dashboard.setBorder(new EmptyBorder(15,15,15,15));
        dashboard.setForeground(TEXT);
        dashboard.setLineWrap(true);
        dashboard.setWrapStyleWord(true);
        p.add(new JScrollPane(dashboard), BorderLayout.CENTER);
        return p;
    }

    private JPanel statCard(String label, String value, String note) {
        JPanel p = new JPanel(); p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
        p.setBackground(Color.WHITE); p.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(new Color(218, 226, 236)), new EmptyBorder(16, 18, 16, 18)));
        JLabel l = new JLabel(label.toUpperCase()); l.setForeground(MUTED);
        l.setFont(new Font("SansSerif", Font.BOLD, 11));
        JLabel v = new JLabel(value); v.setFont(new Font("SansSerif", Font.BOLD, 30)); v.setForeground(BLUE);
        JLabel n = new JLabel(note); n.setForeground(MUTED);
        p.add(l); p.add(Box.createVerticalStrut(8)); p.add(v); p.add(Box.createVerticalStrut(5)); p.add(n);
        return p;
    }

    private JPanel tablePanel(DefaultTableModel m) {
        JPanel p = new JPanel(new BorderLayout(10,10)); p.setBorder(new EmptyBorder(18,20,20,20));
        p.setBackground(PAGE);
        JTable t = new JTable(m); styleTable(t);
        p.add(new JScrollPane(t), BorderLayout.CENTER);
        JButton refresh = new JButton("Refresh"); styleButton(refresh, false); refresh.addActionListener(e -> refreshAll());
        JPanel bottom = new JPanel(new FlowLayout(FlowLayout.RIGHT)); bottom.add(refresh); p.add(bottom, BorderLayout.SOUTH);
        return p;
    }

    private JPanel requestsPanel() {
        JPanel p = new JPanel(new BorderLayout(10,10)); p.setBorder(new EmptyBorder(18,20,20,20));
        p.setBackground(PAGE);
        JTable t = new JTable(requestModel); styleTable(t); p.add(new JScrollPane(t), BorderLayout.CENTER);
        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT));
        actions.setOpaque(false);
        JButton process = new JButton("Process next request"); styleButton(process, true);
        process.addActionListener(e -> {
            service.retryPending();
            String result = service.processNext();
            message(result == null
                    ? "There are no queued or pending requests to process."
                    : result);
            refreshAll();
        });
        JButton all = new JButton("Process all requests"); styleButton(all, true);
        all.addActionListener(e -> {
            service.retryPending();
            java.util.List<String> results = service.processAll();
            message(results.isEmpty()
                    ? "There are no queued or pending requests to process."
                    : String.join("\n", results));
            refreshAll();
        });
        JButton urgency = new JButton("Change selected urgency"); styleButton(urgency, false);
        urgency.addActionListener(e -> changeSelectedUrgency(t));
        actions.add(process); actions.add(all); actions.add(urgency);
        p.add(actions, BorderLayout.SOUTH); return p;
    }

    private JPanel warehousePanel() {
        JPanel p = new JPanel(new BorderLayout(10, 10));
        p.setBorder(new EmptyBorder(18, 18, 18, 18));
        p.setBackground(PAGE);
        JTable table = new JTable(warehouseModel);
        styleTable(table);
        p.add(new JScrollPane(table), BorderLayout.CENTER);

        JButton update = new JButton("Update selected warehouse stock"); styleButton(update, true);
        update.addActionListener(e -> updateSelectedWarehouseStock(table));
        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT)); actions.setOpaque(false);
        actions.add(update);
        p.add(actions, BorderLayout.SOUTH);
        return p;
    }

    private void updateSelectedWarehouseStock(JTable table) {
        int row = table.getSelectedRow();
        if (row < 0) {
            message("Select a warehouse first.");
            return;
        }

        int modelRow = table.convertRowIndexToModel(row);
        String warehouseId = String.valueOf(warehouseModel.getValueAt(modelRow, 0));
        String[] commodities = {"Rice", "Wheat", "Sugar"};
        String commodity = (String) JOptionPane.showInputDialog(
                this, "Choose the commodity:", "Update warehouse stock",
                JOptionPane.PLAIN_MESSAGE, null, commodities, commodities[0]);
        if (commodity == null) {
            return;
        }

        Warehouse warehouse = service.getWarehouses().get(warehouseId);
        double current = warehouse.getCommodityStock().getStock(commodity);
        String value = JOptionPane.showInputDialog(
                this, "Enter new quantity in kg (current: " + current + "):",
                String.valueOf(current));
        if (value == null) {
            return;
        }

        try {
            double quantity = Double.parseDouble(value.trim());
            warehouse.updateStock(commodity, quantity);
            message(warehouseId + " " + commodity + " stock updated to " + quantity + " kg.");
            refreshAll();
        } catch (NumberFormatException ex) {
            message("Quantity must be a valid non-negative number.");
        } catch (IllegalArgumentException ex) {
            message("Stock was not updated: " + ex.getMessage());
        }
    }

    private JPanel createRequestPanel() {
        JPanel outer = new JPanel(new BorderLayout(18,18)); outer.setBorder(new EmptyBorder(22,24,22,24)); outer.setBackground(PAGE);
        JPanel form = new JPanel(new GridBagLayout()); form.setBackground(Color.WHITE);
        form.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createTitledBorder(BorderFactory.createLineBorder(new Color(207, 218, 231)),
                        "  CREATE DELIVERY REQUEST  ", 0, 0,
                        new Font("SansSerif", Font.BOLD, 12), NAVY),
                new EmptyBorder(12, 12, 14, 12)));
        GridBagConstraints c = new GridBagConstraints(); c.insets = new Insets(8,8,8,8); c.anchor = GridBagConstraints.WEST;
        addField(form,c,0,"Request ID",requestId);
        addField(form,c,1,"Fair price shop",shopChoice);
        addField(form,c,2,"Urgency (1 low - 5 severe)",urgencyChoice);
        JPanel item = new JPanel(new FlowLayout(FlowLayout.LEFT,5,0));
        item.add(commodityChoice); item.add(quantity);
        JButton add = new JButton("Add item"); styleButton(add, false); add.addActionListener(e -> {
            String name = (String)commodityChoice.getSelectedItem(); double qty = ((Number)quantity.getValue()).doubleValue();
            draftItems.put(name, draftItems.getOrDefault(name,0.0)+qty); updateDraft();
        });
        item.add(add); addField(form,c,3,"Commodity / quantity (kg)",item);
        draftDisplay.setEditable(false); draftDisplay.setFont(new Font("Monospaced",Font.PLAIN,13));
        addField(form,c,4,"Items in request",new JScrollPane(draftDisplay));
        JButton clear = new JButton("Clear items"); styleButton(clear, false); clear.addActionListener(e -> { draftItems.clear(); updateDraft(); });
        JButton submit = new JButton("Submit request"); styleButton(submit, true);
        submit.addActionListener(e -> submitRequest());
        JPanel buttons = new JPanel(new FlowLayout(FlowLayout.LEFT)); buttons.add(clear); buttons.add(submit);
        c.gridx=1; c.gridy=5; c.gridwidth=2; form.add(buttons,c);
        outer.add(form,BorderLayout.NORTH);
        JTextArea help = new JTextArea("How to use:\n1. Enter a unique request ID (for example R019).\n2. Choose a shop and urgency from 1 to 5.\n3. Add one or more commodities and quantities in kilograms.\n4. Submit, then open Requests to process the queue.\n\nAllocation uses urgency ranking, stock availability, vehicle capacity and the shortest road route.");
        help.setEditable(false);         help.setBackground(PAGE); help.setForeground(MUTED); help.setFont(new Font("SansSerif",Font.PLAIN,14));
        outer.add(help,BorderLayout.CENTER); return outer;
    }

    private void addField(JPanel panel, GridBagConstraints c, int row, String label, Component component) {
        c.gridwidth=1; c.gridx=0; c.gridy=row; panel.add(new JLabel(label),c);
        c.gridx=1; c.gridy=row; c.fill=GridBagConstraints.HORIZONTAL; c.weightx=1; panel.add(component,c);
        c.fill=GridBagConstraints.NONE; c.weightx=0;
    }

    private JPanel dispatchPanel() {
        JPanel p = new JPanel(new BorderLayout(10,10)); p.setBorder(new EmptyBorder(18,20,20,20)); p.setBackground(PAGE);
        JTable t = new JTable(transitModel); styleTable(t); p.add(new JScrollPane(t),BorderLayout.CENTER);
        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT));
        actions.setOpaque(false);
        JButton receipt = new JButton("Confirm selected receipt"); styleButton(receipt, true);
        receipt.addActionListener(e -> {
            int row=t.getSelectedRow(); if(row<0){ message("Select a delivery first."); return; }
            String id=String.valueOf(transitModel.getValueAt(t.convertRowIndexToModel(row),0));
            message(service.confirmReceipt(id)); refreshAll();
        });
        JButton all = new JButton("Confirm all receipts"); styleButton(all, true);
        all.addActionListener(e -> { java.util.List<String> results=service.confirmAllReceipts(); message(results.isEmpty()?"No deliveries in transit.":String.join("\n",results)); refreshAll(); });
        JButton retry = new JButton("Retry pending requests"); styleButton(retry, false);
        retry.addActionListener(e -> { int count=service.retryPending(); message("Retried pending requests: "+count); refreshAll(); });
        actions.add(receipt); actions.add(all); actions.add(retry); p.add(actions,BorderLayout.SOUTH); return p;
    }

    private JPanel historyPanel() {
        JPanel p = new JPanel(new BorderLayout(10,10)); p.setBorder(new EmptyBorder(18,20,20,20)); p.setBackground(PAGE);
        JTable t = new JTable(historyModel); styleTable(t); p.add(new JScrollPane(t),BorderLayout.CENTER);
        return p;
    }

    private void styleTable(JTable table) {
        table.setRowHeight(30); table.setFont(new Font("SansSerif",Font.PLAIN,13));
        table.setForeground(TEXT);
        table.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        table.getTableHeader().setFont(new Font("SansSerif",Font.BOLD,12));
        table.getTableHeader().setBackground(NAVY);
        table.getTableHeader().setForeground(Color.WHITE);
        table.getTableHeader().setPreferredSize(new Dimension(0, 34));
        table.setAutoCreateRowSorter(true); table.setFillsViewportHeight(true);
        table.setShowVerticalLines(false);
        table.setIntercellSpacing(new Dimension(0, 1));
    }
    private void styleButton(JButton button, boolean primary) {
        button.setFont(new Font("SansSerif", Font.BOLD, 12));
        button.setFocusPainted(false);
        button.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(primary ? BLUE : new Color(199, 210, 224)),
                new EmptyBorder(8, 14, 8, 14)));
        button.setBackground(primary ? BLUE : Color.WHITE);
        button.setForeground(primary ? Color.WHITE : TEXT);
        button.setOpaque(true);
        button.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
    }
    private DefaultTableModel model(String... cols) { return new DefaultTableModel(cols,0) { public boolean isCellEditable(int r,int c){return false;} }; }

    private void submitRequest() {
        try {
            if (draftItems.isEmpty()) { message("Add at least one commodity."); return; }
            String id=requestId.getText().trim();
            String shop=(String)shopChoice.getSelectedItem();
            int urgency=Integer.parseInt((String)urgencyChoice.getSelectedItem());
            DeliveryRequest r=service.submitRequest(id,shop,new LinkedHashMap<>(draftItems),urgency);
            message("Request submitted:\n"+r);
            requestId.setText(""); draftItems.clear(); updateDraft(); refreshAll(); tabs.setSelectedIndex(4);
        } catch (Exception ex) { message("Could not submit request: "+ex.getMessage()); }
    }

    private void changeSelectedUrgency(JTable table) {
        int row=table.getSelectedRow(); if(row<0){message("Select a request first.");return;}
        String id=String.valueOf(requestModel.getValueAt(table.convertRowIndexToModel(row),0));
        String value=JOptionPane.showInputDialog(this,"Enter new urgency (1-5):","3");
        if(value==null)return;
        try {
            int urgency=Integer.parseInt(value);
            if(urgency<1||urgency>5)throw new NumberFormatException();
            message(service.changeUrgency(id,urgency)?"Urgency updated.":"Request not found or already dispatched.");
            refreshAll();
        } catch(NumberFormatException ex){message("Urgency must be a number from 1 to 5.");}
    }

    private void updateDraft() { StringBuilder b=new StringBuilder(); draftItems.forEach((k,v)->b.append(k).append(" : ").append(v).append(" kg\n")); draftDisplay.setText(b.toString()); }
    private void refreshAll() {
        warehouseModel.setRowCount(0); shopModel.setRowCount(0); vehicleModel.setRowCount(0);
        requestModel.setRowCount(0); transitModel.setRowCount(0); historyModel.setRowCount(0);
        shopChoice.removeAllItems();
        for(Warehouse w:service.getWarehouses().values()) {
            CommodityStock s=w.getCommodityStock();
            warehouseModel.addRow(new Object[]{w.getId(),w.getName(),s.getStock("Rice"),s.getStock("Wheat"),s.getStock("Sugar")});
        }
        for(FairPriceShop s:service.getShops().values()) {
            shopChoice.addItem(s.getId());
            CommodityStock stock=s.getCommodityStock();
            shopModel.addRow(new Object[]{s.getId(),s.getName(),stock.getStock("Rice"),stock.getStock("Wheat"),stock.getStock("Sugar")});
        }
        for(DeliveryVehicle v:service.getVehicles().values()) vehicleModel.addRow(new Object[]{v.getVehicleId(),v.getVehicleType(),v.getCapacityKg(),v.isAvailable()?"Available":"On trip"});
        for(DeliveryRequest r:service.getAllRequests().values()) requestModel.addRow(new Object[]{r.getRequestId(),r.getShop().getId(),r.getUrgency(),r.getRequiredCommodities(),r.getTotalQuantity(),r.getStatus(),r.getPendingReason()});
        for(DispatchRecord d:service.getInTransit().values()) transitModel.addRow(new Object[]{d.getRequestId(),d.getShopId(),d.getVehicleId(),d.toString()});
        int i=1; for(DispatchRecord d:service.getDispatchHistory()) historyModel.addRow(new Object[]{"Dispatch "+(i++),d.toString()});
        i=1; for(ReceiptRecord r:service.getReceiptHistory()) historyModel.addRow(new Object[]{"Receipt "+(i++),r.toString()});
        int pending=0, dispatched=0, delivered=0;
        for(DeliveryRequest r:service.getAllRequests().values()) {
            if(r.getStatus()==DeliveryRequest.Status.PENDING)pending++;
            if(r.getStatus()==DeliveryRequest.Status.DISPATCHED)dispatched++;
            if(r.getStatus()==DeliveryRequest.Status.DELIVERED)delivered++;
        }
        dashboard.setText("SYSTEM OVERVIEW\n==============================\n"
                +"Loaded requests : "+service.getAllRequests().size()+"\n"
                +"Waiting / pending: "+pending+"\n"
                +"In transit       : "+dispatched+"\n"
                +"Delivered        : "+delivered+"\n"
                +"Dispatch records : "+service.getDispatchHistory().size()+"\n"
                +"Receipt records  : "+service.getReceiptHistory().size()+"\n\n"
                +"WORKFLOW\n==============================\n"
                +"Submit shortage request → priority queue\n"
                +"Find reachable warehouse → verify complete stock\n"
                +"Choose suitable vehicle → shortest route (Dijkstra)\n"
                +"Dispatch goods → confirm receipt at the shop\n\n"
                +"NOTES\n==============================\n"
                +"• Urgency is ranked from 5 (highest) to 1 (lowest).\n"
                +"• Stock is added to a shop only after receipt confirmation.\n"
                +"• Requests that cannot be served remain pending with a reason.\n"
                +"• Use Reset demo to restore the original sample data.");
    }

    private void message(String text) { JOptionPane.showMessageDialog(this,text,"Supply Chain System",JOptionPane.INFORMATION_MESSAGE); }
    public static void launch() { SwingUtilities.invokeLater(() -> new DesktopApp().setVisible(true)); }
}
