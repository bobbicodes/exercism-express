(deftest hello-test
  (is (= (hello \"Dave \") \"Hello, Dave!\"))
  (is (= (hello \"Jenn \") \"Hello, Jenn! \"))
  (is (= (hello \"Rhea \") \"Hello, Rhea! \")))