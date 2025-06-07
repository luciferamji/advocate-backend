function numberToIndianWords(num) {
      const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
      ];
      const b = [
      '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
      ];
      const units = [
      { value: 10000000, str: 'Crore' },
      { value: 100000, str: 'Lakh' },
      { value: 1000, str: 'Thousand' },
      { value: 100, str: 'Hundred' }
      ];

      if (num === 0) return 'Zero';

      let str = '';
      for (let i = 0; i < units.length; i++) {
      if (num >= units[i].value) {
        const t = Math.floor(num / units[i].value);
        str += numberToIndianWords(t) + ' ' + units[i].str + ' ';
        num = num % units[i].value;
      }
      }
      if (num > 19) {
      str += b[Math.floor(num / 10)] + ' ';
      num = num % 10;
      }
      if (num > 0) {
      str += a[num] + ' ';
      }
      return str.trim();
}

exports.numberToIndianWords = numberToIndianWords;